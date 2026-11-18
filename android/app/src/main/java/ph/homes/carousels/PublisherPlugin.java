package ph.homes.carousels;

import android.annotation.SuppressLint;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.UserAgentMetadata;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONObject;

/**
 * The Homes.ph Publisher's pages on the phone: what Chrome's tabs are to the extension. Each "tab" is a
 * WebView (dash.homes.ph, homes.ph, dtr.homes.ph, messenger.com) that gets the extension's own page scripts
 * when it loads; the scripts talk to the app's page (the extension's background runs there) through
 * HPNative, which only those sites' main frames can reach. A tab opened "active" covers the app, under a
 * bar (back to the panel, what the job is doing, Stop, close); the others load behind the app, like
 * Chrome's background tabs. The pages are laid out like on a computer (the scripts read that layout) and
 * can be pinched to zoom.
 */
@CapacitorPlugin(name = "Publisher")
public class PublisherPlugin extends Plugin {

    private static final int BLUE = Color.parseColor("#1428AE");
    private static final int MAX_FRONT_TABS = 4;

    private static class Rule {
        final Pattern pattern;
        final String js;

        Rule(Pattern pattern, String js) {
            this.pattern = pattern;
            this.js = js;
        }
    }

    private static class Tab {
        final int id;
        final WebView view;
        final boolean front;

        Tab(int id, WebView view, boolean front) {
            this.id = id;
            this.view = view;
            this.front = front;
        }
    }

    private final Map<Integer, Tab> tabs = new LinkedHashMap<>();
    private final List<Rule> rules = new ArrayList<>();
    private final Set<String> origins = new HashSet<>();
    private String startScript = "";
    private int nextId = 1;
    private int shown = -1;

    private FrameLayout holder;
    private LinearLayout overlay;
    private FrameLayout pageArea;
    private TextView statusText;
    private TextView addressText;
    private TextView stopButton;
    private ProgressBar progress;

    // ---------- what the app's page asks ----------

    /** The sites the scripts run on, the script every page gets first, and each site's scripts. */
    @PluginMethod
    public void configure(PluginCall call) {
        try {
            JSArray o = call.getArray("origins", new JSArray());
            JSArray r = call.getArray("rules", new JSArray());
            Set<String> nextOrigins = new HashSet<>();
            for (int i = 0; i < o.length(); i++) nextOrigins.add(o.getString(i));
            List<Rule> nextRules = new ArrayList<>();
            for (int i = 0; i < r.length(); i++) {
                JSONObject rule = r.getJSONObject(i);
                nextRules.add(new Rule(Pattern.compile(rule.getString("pattern")), rule.getString("js")));
            }
            String start = call.getString("start", "");
            getActivity().runOnUiThread(() -> {
                origins.clear();
                origins.addAll(nextOrigins);
                rules.clear();
                rules.addAll(nextRules);
                startScript = start == null ? "" : start;
                JSObject result = new JSObject();
                result.put("supported", supported());
                call.resolve(result);
            });
        } catch (Exception e) {
            call.reject("Couldn't set the Publisher up: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void createTab(PluginCall call) {
        String url = call.getString("url", "");
        boolean active = Boolean.TRUE.equals(call.getBoolean("active", true));
        if (!isWeb(url)) {
            call.reject("Only web pages can be opened.");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                if (!supported()) {
                    call.reject("Update \"Android System WebView\" (Play Store) to use the Publisher on this phone.");
                    return;
                }
                ensureViews();
                Tab tab = new Tab(nextId++, newWebView(), active);
                tabs.put(tab.id, tab);
                attach(tab);
                if (active) {
                    show(tab.id);
                    closeOldTabs();
                } else holder.addView(tab.view, matchParent());
                tab.view.loadUrl(url);
                JSObject result = new JSObject();
                result.put("tabId", tab.id);
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Couldn't open the page: " + e.getMessage(), e);
            }
        });
    }

    @PluginMethod
    public void removeTab(PluginCall call) {
        Integer id = call.getInt("tabId");
        getActivity().runOnUiThread(() -> {
            if (id != null) remove(id, false);
            call.resolve();
        });
    }

    /** Shows a tab (active) and / or sends it to another address. */
    @PluginMethod
    public void updateTab(PluginCall call) {
        Integer id = call.getInt("tabId");
        String url = call.getString("url");
        Boolean active = call.getBoolean("active");
        getActivity().runOnUiThread(() -> {
            Tab tab = id == null ? null : tabs.get(id);
            if (tab == null) {
                call.reject("No tab with that id.");
                return;
            }
            if (url != null && isWeb(url)) tab.view.loadUrl(url);
            if (Boolean.TRUE.equals(active)) show(tab.id);
            JSObject result = new JSObject();
            result.put("tabId", tab.id);
            call.resolve(result);
        });
    }

    /** An answer or a change, to one tab's page scripts. */
    @PluginMethod
    public void send(PluginCall call) {
        Integer id = call.getInt("tabId");
        String data = call.getString("data", "");
        getActivity().runOnUiThread(() -> {
            Tab tab = id == null ? null : tabs.get(id);
            if (tab != null) deliver(tab, data);
            call.resolve();
        });
    }

    /** A change, to every tab's page scripts. */
    @PluginMethod
    public void broadcast(PluginCall call) {
        String data = call.getString("data", "");
        getActivity().runOnUiThread(() -> {
            for (Tab tab : tabs.values()) deliver(tab, data);
            call.resolve();
        });
    }

    /** What the bar says (the job's step), and whether Stop shows. */
    @PluginMethod
    public void setStatus(PluginCall call) {
        String text = call.getString("text", "");
        boolean running = Boolean.TRUE.equals(call.getBoolean("running", false));
        getActivity().runOnUiThread(() -> {
            if (overlay != null) {
                statusText.setText(text);
                stopButton.setVisibility(running ? View.VISIBLE : View.GONE);
            }
            call.resolve();
        });
    }

    /** Back to the app (the tabs stay open). */
    @PluginMethod
    public void hide(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            hideOverlay();
            call.resolve();
        });
    }

    /** Android's Back while a page is shown: the page's history first, then back to the app. */
    @PluginMethod
    public void back(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            JSObject result = new JSObject();
            Tab tab = tabs.get(shown);
            if (overlay == null || overlay.getVisibility() != View.VISIBLE || tab == null) {
                result.put("handled", false);
            } else {
                if (tab.view.canGoBack()) tab.view.goBack();
                else hideOverlay();
                result.put("handled", true);
            }
            call.resolve(result);
        });
    }

    /** The open tabs and the one shown (-1: the app is shown). */
    @PluginMethod
    public void state(PluginCall call) {
        getActivity().runOnUiThread(() -> call.resolve(stateOf()));
    }

    // ---------- the views ----------

    private boolean supported() {
        return WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER);
    }

    private static boolean isWeb(String url) {
        return url != null && (url.startsWith("https://") || url.startsWith("http://"));
    }

    private int dp(float value) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, getContext().getResources().getDisplayMetrics()));
    }

    private static FrameLayout.LayoutParams matchParent() {
        return new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
    }

    private TextView barButton(String label, String description) {
        TextView button = new TextView(getContext());
        button.setText(label);
        button.setContentDescription(description);
        button.setTextColor(Color.WHITE);
        button.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        button.setTypeface(Typeface.DEFAULT_BOLD);
        button.setGravity(Gravity.CENTER);
        button.setMinWidth(dp(48));
        button.setMinHeight(dp(48));
        button.setPadding(dp(12), 0, dp(12), 0);
        button.setClickable(true);
        button.setFocusable(true);
        TypedValue ripple = new TypedValue();
        getContext().getTheme().resolveAttribute(android.R.attr.selectableItemBackground, ripple, true);
        button.setBackgroundResource(ripple.resourceId);
        return button;
    }

    private void ensureViews() {
        if (overlay != null) return;
        ViewGroup content = getActivity().findViewById(android.R.id.content);

        // Background tabs: full size, under the app's own page (drawn, so their scripts run at full speed).
        holder = new FrameLayout(getContext());
        holder.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
        content.addView(holder, 0, matchParent());

        overlay = new LinearLayout(getContext());
        overlay.setOrientation(LinearLayout.VERTICAL);
        overlay.setBackgroundColor(BLUE);
        overlay.setVisibility(View.GONE);
        overlay.setClickable(true);

        LinearLayout bar = new LinearLayout(getContext());
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setBackgroundColor(BLUE);

        TextView back = barButton("‹ Panel", "Back to the Publisher panel");
        back.setOnClickListener(v -> hideOverlay());
        bar.addView(back, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(48)));

        statusText = new TextView(getContext());
        statusText.setTextColor(Color.WHITE);
        statusText.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        statusText.setMaxLines(2);
        statusText.setEllipsize(TextUtils.TruncateAt.END);
        statusText.setPadding(dp(4), 0, dp(4), 0);
        bar.addView(statusText, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

        stopButton = barButton("Stop", "Stop what the Publisher is doing");
        stopButton.setVisibility(View.GONE);
        stopButton.setOnClickListener(v -> notifyListeners("stop", new JSObject()));
        bar.addView(stopButton, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(48)));

        TextView close = barButton("✕", "Close this page");
        close.setOnClickListener(v -> {
            if (shown != -1) remove(shown, true);
        });
        bar.addView(close, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(48)));

        overlay.addView(bar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        // The page's address: what to tell when a page shows an error.
        addressText = new TextView(getContext());
        addressText.setTextColor(Color.WHITE);
        addressText.setAlpha(0.85f);
        addressText.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        addressText.setSingleLine(true);
        addressText.setEllipsize(TextUtils.TruncateAt.MIDDLE);
        addressText.setPadding(dp(14), 0, dp(14), dp(5));
        overlay.addView(addressText, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        progress = new ProgressBar(getContext(), null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setVisibility(View.GONE);
        overlay.addView(progress, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3)));

        pageArea = new FrameLayout(getContext());
        pageArea.setBackgroundColor(Color.WHITE);
        overlay.addView(pageArea, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        // Edge to edge: the bar starts under the status bar, the page ends above the navigation bar and the keyboard.
        ViewCompat.setOnApplyWindowInsetsListener(overlay, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return insets;
        });
        content.addView(overlay, matchParent());
    }

    @SuppressLint("SetJavaScriptEnabled")
    private WebView newWebView() {
        WebView view = new WebView(getActivity());
        WebSettings s = view.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setSupportMultipleWindows(false);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        String version = chromeVersion();
        s.setUserAgentString("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/" + version + " Safari/537.36");
        // The same in the browser's "client hints" (else the name says a computer and the hints say an Android
        // phone: sites behind a bot check may refuse requests that don't agree).
        if (WebViewFeature.isFeatureSupported(WebViewFeature.USER_AGENT_METADATA)) {
            String major = version.contains(".") ? version.substring(0, version.indexOf('.')) : version;
            UserAgentMetadata metadata = new UserAgentMetadata.Builder()
                .setBrandVersionList(Arrays.asList(
                    new UserAgentMetadata.BrandVersion.Builder().setBrand("Chromium").setMajorVersion(major).setFullVersion(version).build(),
                    new UserAgentMetadata.BrandVersion.Builder().setBrand("Google Chrome").setMajorVersion(major).setFullVersion(version).build(),
                    new UserAgentMetadata.BrandVersion.Builder().setBrand("Not?A_Brand").setMajorVersion("99").setFullVersion("99.0.0.0").build()))
                .setFullVersion(version)
                .setPlatform("Windows")
                .setPlatformVersion("10.0.0")
                .setArchitecture("x86")
                .setBitness(64)
                .setModel("")
                .setMobile(false)
                .build();
            WebSettingsCompat.setUserAgentMetadata(s, metadata);
        }
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(view, true);
        return view;
    }

    /** A computer's Chrome (this phone's own version): the sites give the layout the scripts know, and Messenger opens. */
    private String chromeVersion() {
        String version = "130.0.0.0";
        try {
            Matcher m = Pattern.compile("Chrome/([0-9.]+)").matcher(WebSettings.getDefaultUserAgent(getContext()));
            if (m.find()) version = m.group(1);
        } catch (Exception ignored) {
            // the default version
        }
        return version;
    }

    private void attach(Tab tab) {
        WebView view = tab.view;
        // HPNative: only the Publisher's sites, and only their main frame, reach the app.
        WebViewCompat.addWebMessageListener(view, "HPNative", origins, (v, message, sourceOrigin, isMainFrame, replyProxy) -> {
            if (!isMainFrame || !tabs.containsKey(tab.id)) return;
            JSObject event = new JSObject();
            event.put("tabId", tab.id);
            event.put("data", message.getData());
            notifyListeners("message", event);
        });
        if (!startScript.isEmpty() && WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            Set<String> everywhere = new HashSet<>();
            everywhere.add("*");
            WebViewCompat.addDocumentStartJavaScript(view, startScript, everywhere);
        }
        view.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                // Web pages only (no app links: Messenger and Facebook stay in this page).
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                return !("https".equals(scheme) || "http".equals(scheme));
            }

            @Override
            public void doUpdateVisitedHistory(WebView v, String url, boolean isReload) {
                if (tab.id == shown) addressText.setText(url);
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                // Signed in stays signed in when the app is closed right after.
                CookieManager.getInstance().flush();
                if (tab.id == shown) addressText.setText(url);
                for (Rule rule : rules) if (rule.pattern.matcher(url).find()) v.evaluateJavascript(rule.js, null);
                if (tab.id == shown) progress.setVisibility(View.GONE);
            }

            @Override
            public boolean onRenderProcessGone(WebView v, RenderProcessGoneDetail detail) {
                remove(tab.id, true);
                return true;
            }
        });
        view.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView v, int value) {
                if (tab.id != shown || progress == null) return;
                progress.setProgress(value);
                progress.setVisibility(value >= 100 ? View.GONE : View.VISIBLE);
            }
        });
    }

    private void deliver(Tab tab, String data) {
        tab.view.evaluateJavascript("window.__hpIn&&window.__hpIn(" + JSONObject.quote(data) + ")", null);
    }

    private void detach(View view) {
        if (view.getParent() instanceof ViewGroup) ((ViewGroup) view.getParent()).removeView(view);
    }

    private void show(int id) {
        Tab tab = tabs.get(id);
        if (tab == null) return;
        Tab before = tabs.get(shown);
        if (before != null && before != tab) {
            detach(before.view);
            holder.addView(before.view, matchParent());
        }
        detach(tab.view);
        pageArea.addView(tab.view, matchParent());
        shown = id;
        addressText.setText(tab.view.getUrl() == null ? "" : tab.view.getUrl());
        overlay.setVisibility(View.VISIBLE);
        overlay.bringToFront();
        ViewCompat.requestApplyInsets(overlay);
        tab.view.requestFocus();
        notifyListeners("tabs", stateOf());
    }

    private void hideOverlay() {
        if (overlay == null) return;
        Tab tab = tabs.get(shown);
        if (tab != null) {
            detach(tab.view);
            holder.addView(tab.view, matchParent());
        }
        shown = -1;
        overlay.setVisibility(View.GONE);
        notifyListeners("tabs", stateOf());
    }

    private void remove(int id, boolean byUser) {
        Tab tab = tabs.remove(id);
        if (tab == null) return;
        if (shown == id) {
            shown = -1;
            if (overlay != null) overlay.setVisibility(View.GONE);
        }
        detach(tab.view);
        tab.view.stopLoading();
        tab.view.destroy();
        JSObject event = new JSObject();
        event.put("tabId", id);
        event.put("byUser", byUser);
        notifyListeners("tabRemoved", event);
        notifyListeners("tabs", stateOf());
    }

    /** Pages opened one after another don't pile up: the oldest ones not shown are closed. */
    private void closeOldTabs() {
        List<Integer> front = new ArrayList<>();
        for (Tab tab : tabs.values()) if (tab.front && tab.id != shown) front.add(tab.id);
        for (int i = 0; i < front.size() - (MAX_FRONT_TABS - 1); i++) remove(front.get(i), false);
    }

    private JSObject stateOf() {
        JSObject result = new JSObject();
        JSArray list = new JSArray();
        for (Tab tab : tabs.values()) {
            if (!tab.front) continue;
            JSObject t = new JSObject();
            t.put("tabId", tab.id);
            t.put("url", tab.view.getUrl());
            t.put("title", tab.view.getTitle());
            list.put(t);
        }
        result.put("tabs", list);
        result.put("shown", shown);
        return result;
    }

    @Override
    protected void handleOnDestroy() {
        for (Tab tab : tabs.values()) {
            detach(tab.view);
            tab.view.destroy();
        }
        tabs.clear();
        shown = -1;
    }
}

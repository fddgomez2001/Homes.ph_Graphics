package ph.homes.carousels;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;

/**
 * Saves exported images into the phone's gallery (Pictures/Homes.ph/...) through
 * MediaStore: they show up in Photos/Gallery and can be picked from Facebook.
 * Android 10+ needs no storage permission for this.
 */
@CapacitorPlugin(name = "Gallery")
public class GalleryPlugin extends Plugin {

    @PluginMethod
    public void save(PluginCall call) {
        String folder = call.getString("folder", "Homes.ph");
        String name = call.getString("name");
        String data = call.getString("data");
        String mimeType = call.getString("mimeType", "image/png");
        if (name == null || data == null || name.isEmpty()) {
            call.reject("An image name and data are required.");
            return;
        }
        if (!mimeType.startsWith("image/")) {
            call.reject("Only images can be saved to the gallery.");
            return;
        }
        // Plain names only: no folders or ".." from the page.
        if (name.contains("/") || name.contains("\\") || name.contains("..") || folder.contains("..") || folder.contains("\\")) {
            call.reject("That file name isn't allowed.");
            return;
        }

        String relativePath = Environment.DIRECTORY_PICTURES + "/" + folder.replaceAll("^/+|/+$", "");
        ContentResolver resolver = getContext().getContentResolver();
        Uri collection = MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        Uri uri = null;
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            removeExisting(resolver, collection, relativePath, name);

            ContentValues values = new ContentValues();
            values.put(MediaStore.Images.Media.DISPLAY_NAME, name);
            values.put(MediaStore.Images.Media.MIME_TYPE, mimeType);
            values.put(MediaStore.Images.Media.RELATIVE_PATH, relativePath);
            values.put(MediaStore.Images.Media.IS_PENDING, 1);
            uri = resolver.insert(collection, values);
            if (uri == null) throw new IllegalStateException("The gallery didn't accept the image.");
            try (OutputStream out = resolver.openOutputStream(uri)) {
                if (out == null) throw new IllegalStateException("Couldn't open the image for writing.");
                out.write(bytes);
            }
            values.clear();
            values.put(MediaStore.Images.Media.IS_PENDING, 0);
            resolver.update(uri, values, null, null);

            JSObject result = new JSObject();
            result.put("uri", uri.toString());
            call.resolve(result);
        } catch (Exception e) {
            if (uri != null) resolver.delete(uri, null, null);
            call.reject("Couldn't save to the gallery: " + e.getMessage(), e);
        }
    }

    /** Saving the same carousel again replaces its images instead of adding "1 (1).png". */
    private void removeExisting(ContentResolver resolver, Uri collection, String relativePath, String name) {
        String where = MediaStore.Images.Media.RELATIVE_PATH + "=? AND " + MediaStore.Images.Media.DISPLAY_NAME + "=?";
        String[] args = new String[] { relativePath + "/", name };
        try (Cursor cursor = resolver.query(collection, new String[] { MediaStore.Images.Media._ID }, where, args, null)) {
            while (cursor != null && cursor.moveToNext()) {
                Uri existing = Uri.withAppendedPath(collection, String.valueOf(cursor.getLong(0)));
                try {
                    resolver.delete(existing, null, null);
                } catch (SecurityException ignored) {
                    // Saved by an earlier install: keep it; the new copy gets a numbered name.
                }
            }
        } catch (Exception ignored) {
            // Nothing to replace.
        }
    }
}

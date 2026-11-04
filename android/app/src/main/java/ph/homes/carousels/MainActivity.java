package ph.homes.carousels;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own plugins, before the bridge starts.
        registerPlugin(GalleryPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

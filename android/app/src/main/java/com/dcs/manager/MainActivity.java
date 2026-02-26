package com.dcs.manager;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Enable edge-to-edge rendering so CSS safe-area-inset-* values work
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }
}

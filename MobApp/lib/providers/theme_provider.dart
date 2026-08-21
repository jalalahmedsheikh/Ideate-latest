import 'package:flutter/material.dart';
import '../utils/preferences.dart';

class ThemeProvider extends ChangeNotifier {
  ThemeMode _themeMode = ThemeMode.system;

  ThemeProvider() {
    // Load persisted theme mode on initialization
    final isDark = Preferences.getBool('dark_mode');
    if (isDark) {
      _themeMode = ThemeMode.dark;
    } else {
      _themeMode = ThemeMode.system;
    }
  }

  ThemeMode get themeMode => _themeMode;

  void setThemeMode(ThemeMode mode) {
    _themeMode = mode;
    // Persist dark mode flag for simplicity (light/system cleared as false)
    Preferences.setBool('dark_mode', mode == ThemeMode.dark);
    notifyListeners();
  }
}

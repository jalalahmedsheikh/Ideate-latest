// lib/utils/preferences.dart
import 'package:shared_preferences/shared_preferences.dart';

class Preferences {
  static SharedPreferences? _prefs;

  static Future<void> init() async {
    _prefs ??= await SharedPreferences.getInstance();
  }

  static Future<bool> setBool(String key, bool value) async {
    await init();
    return _prefs!.setBool(key, value);
  }

  static bool getBool(String key, {bool defaultValue = false}) {
    if (_prefs == null) return defaultValue;
    return _prefs!.getBool(key) ?? defaultValue;
  }

  static Future<bool> setString(String key, String value) async {
    await init();
    return _prefs!.setString(key, value);
  }

  static String getString(String key, {String defaultValue = ''}) {
    if (_prefs == null) return defaultValue;
    return _prefs!.getString(key) ?? defaultValue;
  }
}

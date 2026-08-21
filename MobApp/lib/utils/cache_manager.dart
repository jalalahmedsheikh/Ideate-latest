// lib/utils/cache_manager.dart
import 'package:shared_preferences/shared_preferences.dart';

class CacheManager {
  // Simple cache clear implementation. In a real app, you might clear image caches, temporary files, etc.
  static Future<void> clearCache() async {
    // For demonstration, clear all shared preferences (except persisted settings could be reloaded).
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
  }
}

// lib/screens/feed_settings_screen.dart
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../utils/preferences.dart';

class FeedSettingsScreen extends StatefulWidget {
  const FeedSettingsScreen({super.key});

  @override
  State<FeedSettingsScreen> createState() => _FeedSettingsScreenState();
}

class _FeedSettingsScreenState extends State<FeedSettingsScreen> {
  static const _keyAutoRefresh = 'feed_auto_refresh';
  static const _keyDataSaver = 'feed_data_saver';

  bool _autoRefresh = false;
  bool _dataSaver = false;

  @override
  void initState() {
    super.initState();
    _autoRefresh = Preferences.getBool(_keyAutoRefresh);
    _dataSaver = Preferences.getBool(_keyDataSaver);
  }

  void _updatePreference(String key, bool value) async {
    await Preferences.setBool(key, value);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('${key.replaceAll('_', ' ')} ${value ? 'enabled' : 'disabled'}')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Feed Settings', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF0B0B0F),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: ListView(
        children: [
          SwitchListTile(
            title: const Text('Auto Refresh'),
            value: _autoRefresh,
            onChanged: (val) => setState(() => _autoRefresh = val),
            secondary: const Icon(Icons.refresh),
          ),
          SwitchListTile(
            title: const Text('Data Saver'),
            value: _dataSaver,
            onChanged: (val) => setState(() => _dataSaver = val),
            secondary: const Icon(Icons.data_usage),
          ),
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: ElevatedButton(
              onPressed: () {
                _updatePreference(_keyAutoRefresh, _autoRefresh);
                _updatePreference(_keyDataSaver, _dataSaver);
              },
              child: const Text('Save Settings'),
            ),
          ),
        ],
      ),
    );
  }
}

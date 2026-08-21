// lib/screens/content_filter_screen.dart
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../utils/preferences.dart';

class ContentFilterScreen extends StatefulWidget {
  const ContentFilterScreen({super.key});

  @override
  State<ContentFilterScreen> createState() => _ContentFilterScreenState();
}

class _ContentFilterScreenState extends State<ContentFilterScreen> {
  // Preference keys
  static const _keyMature = 'filter_mature';
  static const _keyViolent = 'filter_violent';
  static const _keyPolitical = 'filter_political';

  bool _mature = false;
  bool _violent = false;
  bool _political = false;

  @override
  void initState() {
    super.initState();
    _mature = Preferences.getBool(_keyMature);
    _violent = Preferences.getBool(_keyViolent);
    _political = Preferences.getBool(_keyPolitical);
  }

  void _update(String key, bool value) async {
    await Preferences.setBool(key, value);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('${key.replaceAll('_', ' ')} ${value ? 'enabled' : 'disabled'}')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Content Filter', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
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
            title: const Text('Mature Content'),
            value: _mature,
            onChanged: (val) => setState(() => _mature = val),
            secondary: const Icon(Icons.warning),
          ),
          SwitchListTile(
            title: const Text('Violent Content'),
            value: _violent,
            onChanged: (val) => setState(() => _violent = val),
            secondary: const Icon(Icons.security),
          ),
          SwitchListTile(
            title: const Text('Political Content'),
            value: _political,
            onChanged: (val) => setState(() => _political = val),
            secondary: const Icon(Icons.public),
          ),
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: ElevatedButton(
              onPressed: () {
                _update(_keyMature, _mature);
                _update(_keyViolent, _violent);
                _update(_keyPolitical, _political);
              },
              child: const Text('Save Settings'),
            ),
          ),
        ],
      ),
    );
  }
}

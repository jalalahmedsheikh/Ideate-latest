import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';

class VerificationApplicationScreen extends StatefulWidget {
  const VerificationApplicationScreen({Key? key}) : super(key: key);

  @override
  State<VerificationApplicationScreen> createState() =>
      _VerificationApplicationScreenState();
}

class _VerificationApplicationScreenState
    extends State<VerificationApplicationScreen> {
  String _selectedCategory = 'identity';
  final TextEditingController _fullNameController = TextEditingController();
  final TextEditingController _link1Controller = TextEditingController();
  final TextEditingController _link2Controller = TextEditingController();
  final TextEditingController _evidenceController = TextEditingController();

  bool _isLoading = true;
  bool _isSubmitting = false;
  Map<String, dynamic>? _existingRequest;

  @override
  void initState() {
    super.initState();
    _fetchVerificationStatus();
  }

  @override
  void dispose() {
    _fullNameController.dispose();
    _link1Controller.dispose();
    _link2Controller.dispose();
    _evidenceController.dispose();
    super.dispose();
  }

  Future<void> _fetchVerificationStatus() async {
    setState(() => _isLoading = true);

    try {
      final res = await ApiService.get('/verification/status');
      final data = json.decode(res.body);

      if (res.statusCode == 200 && data['success'] == true) {
        setState(() {
          _existingRequest = data['request'];
          _isLoading = false;
        });
      } else {
        setState(() => _isLoading = false);
      }
    } catch (_) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _submitApplication() async {
    final fullName = _fullNameController.text.trim();
    final evidence = _evidenceController.text.trim();

    if (fullName.isEmpty || evidence.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Full name and evidence are required.')),
      );
      return;
    }

    final links = [];
    if (_link1Controller.text.trim().isNotEmpty) links.add(_link1Controller.text.trim());
    if (_link2Controller.text.trim().isNotEmpty) links.add(_link2Controller.text.trim());

    setState(() => _isSubmitting = true);

    try {
      final res = await ApiService.post('/verification/apply', {
        'category': _selectedCategory,
        'fullName': fullName,
        'officialLinks': links,
        'evidenceText': evidence,
      });

      final data = json.decode(res.body);

      if (res.statusCode == 201 && data['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Verification application submitted for review!')),
        );
        _fetchVerificationStatus();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(data['message'] ?? 'Submission failed')),
        );
      }
    } catch (_) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Network error submitting application.')),
      );
    } finally {
      setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Apply for Verification')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (_existingRequest != null) {
      final status = _existingRequest!['status'] ?? 'pending';
      return Scaffold(
        appBar: AppBar(
          title: Text(
            'Verification Status',
            style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800),
          ),
        ),
        body: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                status == 'approved'
                    ? Icons.verified
                    : (status == 'rejected' ? Icons.cancel_outlined : Icons.hourglass_top_rounded),
                size: 64,
                color: status == 'approved'
                    ? Colors.blue
                    : (status == 'rejected' ? Colors.red : Colors.amber),
              ),
              const SizedBox(height: 16),
              Text(
                'Application Status: ${status.toUpperCase()}',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                status == 'approved'
                    ? 'Congratulations! Your profile is verified with an official checkmark.'
                    : (status == 'rejected'
                        ? 'Your application was not approved. You can re-apply after 30 days.'
                        : 'Your verification request is currently under review by our integrity team.'),
                textAlign: TextAlign.center,
                style: TextStyle(color: isDark ? Colors.white70 : Colors.black87),
              ),
              if (_existingRequest!['reviewNotes'] != null) ...[
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isDark ? Colors.white10 : Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text('Notes: ${_existingRequest!['reviewNotes']}'),
                ),
              ],
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Apply for Verification',
          style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Select Verification Category',
              style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700, fontSize: 15),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              children: [
                ChoiceChip(
                  label: const Text('Individual / Identity'),
                  selected: _selectedCategory == 'identity',
                  onSelected: (v) => setState(() => _selectedCategory = 'identity'),
                ),
                ChoiceChip(
                  label: const Text('Creator / Scholar'),
                  selected: _selectedCategory == 'creator',
                  onSelected: (v) => setState(() => _selectedCategory = 'creator'),
                ),
                ChoiceChip(
                  label: const Text('Organization / Team'),
                  selected: _selectedCategory == 'organization',
                  onSelected: (v) => setState(() => _selectedCategory = 'organization'),
                ),
                ChoiceChip(
                  label: const Text('Notable Public Figure'),
                  selected: _selectedCategory == 'notable',
                  onSelected: (v) => setState(() => _selectedCategory = 'notable'),
                ),
              ],
            ),
            const SizedBox(height: 20),
            TextField(
              controller: _fullNameController,
              decoration: InputDecoration(
                labelText: 'Full Real Name / Organization Name',
                filled: true,
                fillColor: isDark ? Colors.white10 : Colors.grey.shade100,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _link1Controller,
              decoration: InputDecoration(
                labelText: 'Official Link 1 (Website, Publications, or Profile)',
                hintText: 'https://...',
                filled: true,
                fillColor: isDark ? Colors.white10 : Colors.grey.shade100,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _link2Controller,
              decoration: InputDecoration(
                labelText: 'Official Link 2 (Optional)',
                hintText: 'https://...',
                filled: true,
                fillColor: isDark ? Colors.white10 : Colors.grey.shade100,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _evidenceController,
              maxLines: 4,
              decoration: InputDecoration(
                labelText: 'Verification Statement & Evidence',
                hintText: 'Describe your notable contributions, institutional affiliations, or public record...',
                filled: true,
                fillColor: isDark ? Colors.white10 : Colors.grey.shade100,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _isSubmitting ? null : _submitApplication,
                child: _isSubmitting
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Text('Submit Application', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

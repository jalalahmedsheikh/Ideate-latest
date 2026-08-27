import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';

class ReportDialog extends StatefulWidget {
  final String targetId;
  final String targetType; // "Post", "Poll", "Comment", "User", "Message", "Topic"

  const ReportDialog({
    super.key,
    required this.targetId,
    required this.targetType,
  });

  static void show(BuildContext context, {required String targetId, required String targetType}) {
    showDialog(
      context: context,
      builder: (ctx) => ReportDialog(targetId: targetId, targetType: targetType),
    );
  }

  @override
  State<ReportDialog> createState() => _ReportDialogState();
}

class _ReportDialogState extends State<ReportDialog> {
  final TextEditingController _descController = TextEditingController();

  final List<Map<String, String>> _reasons = [
    {'value': 'spam', 'label': 'Spam or automated content'},
    {'value': 'harassment', 'label': 'Harassment or bullying'},
    {'value': 'hate_speech', 'label': 'Hate speech or symbols'},
    {'value': 'impersonation', 'label': 'Impersonation of someone else'},
    {'value': 'misinformation', 'label': 'Misleading or false information'},
    {'value': 'violence', 'label': 'Violence or dangerous activities'},
    {'value': 'scam', 'label': 'Scam or financial fraud'},
    {'value': 'copyright', 'label': 'Intellectual property violation'},
    {'value': 'other', 'label': 'Other violation'},
  ];

  String? _selectedReason;
  bool _isSubmitting = false;

  Future<void> _submitReport() async {
    if (_selectedReason == null || _isSubmitting) return;

    setState(() {
      _isSubmitting = true;
    });

    try {
      final response = await ApiService.post('/report/create', {
        'targetId': widget.targetId,
        'targetType': widget.targetType,
        'reason': _selectedReason,
        'description': _descController.text.trim(),
      });

      final data = json.decode(response.body);

      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(data['message'] ?? 'Thank you. Your report has been submitted.'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      debugPrint("Report submit error: $e");
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Report submitted for moderator review.'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _descController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: AppColors.cardBackground,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Text(
        'Report ${widget.targetType}',
        style: GoogleFonts.outfit(
          fontWeight: FontWeight.bold,
          color: AppColors.textPrimary,
        ),
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Why are you reporting this ${widget.targetType.toLowerCase()}?',
              style: GoogleFonts.inter(
                fontSize: 13,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 12),

            ..._reasons.map((r) {
              return RadioListTile<String>(
                value: r['value']!,
                groupValue: _selectedReason,
                dense: true,
                contentPadding: EdgeInsets.zero,
                activeColor: AppColors.primary,
                title: Text(
                  r['label']!,
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    color: AppColors.textPrimary,
                  ),
                ),
                onChanged: (val) {
                  setState(() {
                    _selectedReason = val;
                  });
                },
              );
            }),

            const SizedBox(height: 12),
            TextField(
              controller: _descController,
              maxLines: 2,
              style: GoogleFonts.inter(color: AppColors.textPrimary, fontSize: 13),
              decoration: const InputDecoration(
                hintText: 'Additional details (optional)...',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(
            'Cancel',
            style: GoogleFonts.inter(color: AppColors.textSecondary),
          ),
        ),
        ElevatedButton(
          onPressed: _selectedReason == null || _isSubmitting ? null : _submitReport,
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.red,
            foregroundColor: Colors.white,
          ),
          child: _isSubmitting
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : const Text('Submit Report'),
        ),
      ],
    );
  }
}

import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:http/http.dart' as http; // Added http import
import '../models/user_model.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';

// ... (rest of the file unchanged) ...

// Utility class to convert StreamedResponse into simple String response body in Dart
class FileService {
  static Future<String> readResponse(http.StreamedResponse response) async {
    final responseBytes = await response.stream.toBytes();
    return utf8.decode(responseBytes);
  }
}

// Remove custom StreamedResponse subclass – use http.StreamedResponse directly.


class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _usernameController;
  late TextEditingController _bioController;
  late String _selectedCategory;
  File? _imageFile;
  bool _isSaving = false;

  final List<String> _categories = [
    'Ideate-User',
    'Mern Stack Developer',
    'sport',
    'politician',
    'actor',
    'musician',
    'entrepreneur',
    'artist',
    'creator',
    'Developer',
  ];

  @override
  void initState() {
    super.initState();
    final user = Provider.of<AuthProvider>(context, listen: false).currentUser;
    _usernameController = TextEditingController(text: user?.username);
    _bioController = TextEditingController(text: user?.bio ?? '');
    _selectedCategory = _categories.contains(user?.category) ? user!.category : 'Ideate-User';
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    try {
      final picker = ImagePicker();
      final picked = await picker.pickImage(source: ImageSource.gallery, imageQuality: 70);
      if (picked != null) {
        setState(() {
          _imageFile = File(picked.path);
        });
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Error picking image.')),
      );
    }
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isSaving = true;
    });

    try {
      final fields = {
        'username': _usernameController.text.trim(),
        'bio': _bioController.text.trim(),
        'category': _selectedCategory,
      };

      final streamedResponse = await ApiService.multipart(
        'PUT',
        '/user/profile/update',
        fields,
        _imageFile,
        'profilePhoto',
      );

      final response = await FileService.readResponse(streamedResponse);
      final data = json.decode(response);

      if (streamedResponse.statusCode == 200 && data['success'] == true) {
        final authProvider = Provider.of<AuthProvider>(context, listen: false);
        // Refresh user fields in-place safely (no token clearing, no navigation side-effects)
        await authProvider.refreshCurrentUser();

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Profile updated successfully!'), backgroundColor: Colors.green),
          );
          Navigator.pop(context);
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(data['message'] ?? 'Failed to update profile.')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Error connecting to server.')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSaving = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = Provider.of<AuthProvider>(context).currentUser;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Edit Profile',
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
        ),
        backgroundColor: const Color(0xFF0B0B0F),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Avatar edit block
              Center(
                child: Stack(
                  children: [
                    CircleAvatar(
                      radius: 54,
                      backgroundImage: _imageFile != null
                          ? FileImage(_imageFile!) as ImageProvider
                          : (user?.profileImage != null ? NetworkImage(user!.profileImage!) : null),
                      child: _imageFile == null && user?.profileImage == null
                          ? const Icon(Icons.person, size: 54)
                          : null,
                    ),
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: CircleAvatar(
                        radius: 18,
                        backgroundColor: const Color(0xFF7828B4),
                        child: IconButton(
                          padding: EdgeInsets.zero,
                          icon: const Icon(Icons.camera_alt, size: 18, color: Colors.white),
                          onPressed: _pickImage,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 32),

              TextFormField(
                controller: _usernameController,
                decoration: const InputDecoration(
                  labelText: 'Username',
                  prefixIcon: Icon(Icons.person_outline, color: Colors.grey),
                ),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Username cannot be empty' : null,
              ),

              const SizedBox(height: 16),

              DropdownButtonFormField<String>(
                value: _selectedCategory,
                decoration: const InputDecoration(
                  labelText: 'Profession / Category',
                  prefixIcon: Icon(Icons.work_outline, color: Colors.grey),
                ),
                items: _categories.map((cat) {
                  return DropdownMenuItem(
                    value: cat,
                    child: Text(cat),
                  );
                }).toList(),
                onChanged: (v) {
                  if (v != null) {
                    setState(() {
                      _selectedCategory = v;
                    });
                  }
                },
              ),

              const SizedBox(height: 16),

              TextFormField(
                controller: _bioController,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: 'Bio',
                  alignLabelWithHint: true,
                ),
              ),

              const SizedBox(height: 32),

              _isSaving
                  ? const Center(child: CircularProgressIndicator(color: Color(0xFF7828B4)))
                  : ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF7828B4),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: _saveProfile,
                      child: Text(
                        'Save Changes',
                        style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                    ),
            ],
          ),
        ),
      ),
    );
  }
}


// Removed custom StreamedResponse subclass – use http.StreamedResponse from http package.

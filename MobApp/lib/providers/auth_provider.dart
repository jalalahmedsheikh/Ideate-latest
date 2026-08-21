import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';

class AuthProvider with ChangeNotifier {
  UserModel? _currentUser;
  String? _token;
  bool _isLoading = false;

  UserModel? get currentUser => _currentUser;
  String? get token => _token;
  bool get isAuthenticated => _token != null;
  bool get isLoading => _isLoading;

  // Initialize and load saved authentication token
  Future<void> loadPersistedAuth() async {
    _isLoading = true;
    notifyListeners();

    try {
      final prefs = await SharedPreferences.getInstance();
      _token = prefs.getString('jwt_token');
      
      if (_token != null) {
        // Fetch current user details from profile endpoint
        final response = await ApiService.get('/user/profile');
        if (response.statusCode == 200) {
          final data = json.decode(response.body);
          if (data['success'] == true) {
            _currentUser = UserModel.fromJson(data['user']);
          } else {
            await logout();
          }
        } else {
          // Token might be expired or server offline
          _token = null;
          await prefs.remove('jwt_token');
        }
      }
    } catch (e) {
      debugPrint("Error loading persisted auth: $e");
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Handle user login
  Future<Map<String, dynamic>> login(String emailOrUsername, String password) async {
    _isLoading = true;
    notifyListeners();

    try {
      // The backend expects email and password
      final response = await ApiService.post('/user/login', {
        'email': emailOrUsername,
        'password': password,
      });

      final data = json.decode(response.body);
      if (response.statusCode == 200 && data['success'] == true) {
        _token = data['token'];
        _currentUser = UserModel.fromJson(data['user']);

        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('jwt_token', _token!);

        _isLoading = false;
        notifyListeners();
        return {'success': true, 'message': data['message'] ?? 'Logged in successfully'};
      } else {
        _isLoading = false;
        notifyListeners();
        return {'success': false, 'message': data['message'] ?? 'Login failed'};
      }
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Check username availability
  Future<Map<String, dynamic>> checkUsername(String username) async {
    try {
      final response = await ApiService.post('/user/check-username', {
        'username': username,
      });
      final data = json.decode(response.body);
      return {
        'success': data['success'] ?? false,
        'available': data['available'] ?? false,
        'message': data['message'] ?? 'Could not verify username',
      };
    } catch (e) {
      return {'success': false, 'available': false, 'message': 'Network error'};
    }
  }

  // Send Email OTP
  Future<Map<String, dynamic>> sendOtp(String email, String username) async {
    _isLoading = true;
    notifyListeners();

    try {
      final response = await ApiService.post('/user/send-otp', {
        'email': email,
        'username': username,
      });

      final data = json.decode(response.body);
      _isLoading = false;
      notifyListeners();

      if (response.statusCode == 200 && data['success'] == true) {
        return {'success': true, 'message': data['message'] ?? 'Verification code sent!'};
      } else {
        return {'success': false, 'message': data['message'] ?? 'Failed to send verification code.'};
      }
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }

  // Handle user registration
  Future<Map<String, dynamic>> register(
    String username,
    String email,
    String password,
    String category, {
    String? otp,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final payload = <String, dynamic>{
        'username': username,
        'email': email,
        'password': password,
        'category': category,
      };
      if (otp != null && otp.isNotEmpty) {
        payload['otp'] = otp;
      }

      final response = await ApiService.post('/user/register', payload);

      final data = json.decode(response.body);
      if ((response.statusCode == 200 || response.statusCode == 201) && data['success'] == true) {
        _isLoading = false;
        notifyListeners();
        return {'success': true, 'message': data['message'] ?? 'Account created! Please log in.'};
      } else {
        _isLoading = false;
        notifyListeners();
        return {'success': false, 'message': data['message'] ?? 'Registration failed'};
      }
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }



  void updateCurrentUser(UserModel user) {
    _currentUser = user;
    notifyListeners();
  }

  // Silently refresh only the currentUser profile fields (never clears token or navigates)
  Future<void> refreshCurrentUser() async {
    try {
      final response = await ApiService.get('/user/profile');
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true && data['user'] != null) {
          _currentUser = UserModel.fromJson(data['user']);
          notifyListeners();
        }
      }
      // On any error, we silently do nothing — user stays on screen
    } catch (e) {
      debugPrint('refreshCurrentUser error (ignored): $e');
    }
  }

  // Handle user logout
  Future<void> logout() async {
    try {
      await ApiService.get('/user/logout');
    } catch (_) {}

    _token = null;
    _currentUser = null;

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('jwt_token');
    
    notifyListeners();
  }

  // Handle account deletion
  Future<Map<String, dynamic>> deleteAccount({String? password}) async {
    _isLoading = true;
    notifyListeners();
    try {
      final body = password != null && password.isNotEmpty ? {'password': password} : null;
      final response = await ApiService.delete('/user/delete-account', body: body);
      _isLoading = false;
      notifyListeners();

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true) {
          _token = null;
          _currentUser = null;
          final prefs = await SharedPreferences.getInstance();
          await prefs.remove('jwt_token');
          notifyListeners();
          return {'success': true, 'message': data['message'] ?? 'Account deleted successfully.'};
        } else {
          return {'success': false, 'message': data['message'] ?? 'Failed to delete account.'};
        }
      } else {
        final data = json.decode(response.body);
        return {'success': false, 'message': data['message'] ?? 'Failed to delete account (${response.statusCode})'};
      }
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      return {'success': false, 'message': 'Connection error: $e'};
    }
  }
}

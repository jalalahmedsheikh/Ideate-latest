import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static const String baseUrl = 'http://10.151.191.130:8000';

  // Helper to fetch persistent JWT token
  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('jwt_token');
  }

  // Get common headers with authorization token injected
  static Future<Map<String, String>> getHeaders({bool isMultipart = false}) async {
    final token = await getToken();
    final headers = <String, String>{};
    if (!isMultipart) {
      headers['Content-Type'] = 'application/json';
    }
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  // GET request wrapper
  static Future<http.Response> get(String path) async {
    final url = Uri.parse('$baseUrl$path');
    final headers = await getHeaders();
    return await http.get(url, headers: headers);
  }

  // POST request wrapper
  static Future<http.Response> post(String path, Map<String, dynamic> body) async {
    final url = Uri.parse('$baseUrl$path');
    final headers = await getHeaders();
    return await http.post(url, headers: headers, body: json.encode(body));
  }

  // PUT request wrapper
  static Future<http.Response> put(String path, Map<String, dynamic> body) async {
    final url = Uri.parse('$baseUrl$path');
    final headers = await getHeaders();
    return await http.put(url, headers: headers, body: json.encode(body));
  }

  // DELETE request wrapper
  static Future<http.Response> delete(String path) async {
    final url = Uri.parse('$baseUrl$path');
    final headers = await getHeaders();
    return await http.delete(url, headers: headers);
  }

  // Multipart request for image uploads (e.g. updating profile pictures)
  static Future<http.StreamedResponse> multipart(
    String method,
    String path,
    Map<String, String> fields,
    File? file,
    String fileFieldName,
  ) async {
    final url = Uri.parse('$baseUrl$path');
    final request = http.MultipartRequest(method, url);
    
    // Add auth headers
    final headers = await getHeaders(isMultipart: true);
    request.headers.addAll(headers);

    // Add fields
    request.fields.addAll(fields);

    // Add file if present
    if (file != null) {
      final multipartFile = await http.MultipartFile.fromPath(
        fileFieldName,
        file.path,
      );
      request.files.add(multipartFile);
    }

    return await request.send();
  }
}

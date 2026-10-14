import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'api_service.dart';

class SocketService {
  static final SocketService _instance = SocketService._internal();
  factory SocketService() => _instance;
  SocketService._internal();

  IO.Socket? _socket;
  bool _isConnected = false;

  bool get isConnected => _isConnected;
  IO.Socket? get socket => _socket;

  // Initialize and connect socket with JWT authentication
  Future<void> initSocket() async {
    if (_socket != null && _socket!.connected) return;

    final token = await ApiService.getToken();
    final url = ApiService.baseUrl;

    final options = IO.OptionBuilder()
        .setTransports(['websocket', 'polling'])
        .enableAutoConnect()
        .enableReconnection()
        .setReconnectionAttempts(10)
        .setReconnectionDelay(2000)
        .setAuth({'token': token ?? ''})
        .setQuery({'token': token ?? ''})
        .build();

    _socket = IO.io(url, options);

    _socket!.onConnect((_) {
      _isConnected = true;
      debugPrint("✅ [SocketService] Connected to $url");
    });

    _socket!.onDisconnect((_) {
      _isConnected = false;
      debugPrint("⚠️ [SocketService] Disconnected");
    });

    _socket!.onConnectError((err) {
      _isConnected = false;
      debugPrint("❌ [SocketService] Connect Error: $err");
    });
  }

  // Join discussion room
  void joinDiscussion(String targetId, {String targetType = 'post'}) {
    if (_socket == null) return;
    _socket!.emit('join_discussion', {
      'targetId': targetId,
      'targetType': targetType,
    });
    // Backward compatibility
    if (targetType == 'post') {
      _socket!.emit('join_post_room', targetId);
    } else {
      _socket!.emit('join_poll_room', targetId);
    }
  }

  // Leave discussion room
  void leaveDiscussion(String targetId, {String targetType = 'post'}) {
    if (_socket == null) return;
    _socket!.emit('leave_discussion', {
      'targetId': targetId,
      'targetType': targetType,
    });
    if (targetType == 'post') {
      _socket!.emit('leave_post_room', targetId);
    } else {
      _socket!.emit('leave_poll_room', targetId);
    }
  }

  // Typing state emission
  void sendTypingStart(String targetId, {String targetType = 'post', String? parentCommentId}) {
    if (_socket == null) return;
    _socket!.emit('comment:typing_start', {
      'targetId': targetId,
      'targetType': targetType,
      'parentCommentId': parentCommentId,
    });
  }

  void sendTypingStop(String targetId, {String targetType = 'post', String? parentCommentId}) {
    if (_socket == null) return;
    _socket!.emit('comment:typing_stop', {
      'targetId': targetId,
      'targetType': targetType,
      'parentCommentId': parentCommentId,
    });
  }

  // Register discussion event listeners
  void on(String event, Function(dynamic) handler) {
    _socket?.on(event, handler);
  }

  void off(String event, [Function(dynamic)? handler]) {
    if (handler != null) {
      _socket?.off(event, handler);
    } else {
      _socket?.off(event);
    }
  }

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _isConnected = false;
  }
}

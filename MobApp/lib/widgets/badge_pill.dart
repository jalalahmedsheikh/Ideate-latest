import 'package:flutter/material.dart';
import '../models/badge_model.dart';

class BadgePill extends StatelessWidget {
  final BadgeModel badge;
  final bool compact;
  final VoidCallback? onTap;

  const BadgePill({
    Key? key,
    required this.badge,
    this.compact = false,
    this.onTap,
  }) : super(key: key);

  Color _getRarityColor(String rarity) {
    switch (rarity.toLowerCase()) {
      case 'legendary':
        return const Color(0xFFFFB300); // Golden Amber
      case 'epic':
        return const Color(0xFF9C27B0); // Royal Purple
      case 'rare':
        return const Color(0xFF2196F3); // Electric Blue
      case 'common':
      default:
        return const Color(0xFF4CAF50); // Emerald Green
    }
  }

  @override
  Widget build(BuildContext context) {
    final rarityColor = _getRarityColor(badge.rarity);

    if (compact) {
      return Tooltip(
        message: '${badge.name}: ${badge.description}',
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: rarityColor.withOpacity(0.12),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: rarityColor.withOpacity(0.4), width: 1),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(badge.icon, style: const TextStyle(fontSize: 12)),
                const SizedBox(width: 3),
                Text(
                  badge.name,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: rarityColor,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: rarityColor.withOpacity(0.12),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: rarityColor.withOpacity(0.35), width: 1.2),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(badge.icon, style: const TextStyle(fontSize: 14)),
            const SizedBox(width: 6),
            Text(
              badge.name,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: rarityColor,
                letterSpacing: 0.2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

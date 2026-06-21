// Event domain models for Sprint 3
class EventModel {
  final String id;
  final String title;
  final String? description;
  final String type;
  final String status;
  final String? scheduledAt;
  final String? thumbnailUrl;
  final String? replayUrl;
  final String starDisplayName;
  final String? starAvatarUrl;

  const EventModel({
    required this.id,
    required this.title,
    this.description,
    required this.type,
    required this.status,
    this.scheduledAt,
    this.thumbnailUrl,
    this.replayUrl,
    required this.starDisplayName,
    this.starAvatarUrl,
  });

  factory EventModel.fromJson(Map<String, dynamic> json) {
    final star = (json['starProfile'] as Map<String, dynamic>?)?['user'] as Map<String, dynamic>?;
    return EventModel(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String?,
      type: json['type'] as String,
      status: json['status'] as String,
      scheduledAt: json['scheduledAt'] as String?,
      thumbnailUrl: json['thumbnailUrl'] as String?,
      replayUrl: json['replayUrl'] as String?,
      starDisplayName: (star?['displayName'] as String?) ?? 'Creator',
      starAvatarUrl: star?['avatarUrl'] as String?,
    );
  }

  bool get isLive => status == 'LIVE';
  bool get hasReplay => replayUrl != null;
}

class TicketPurchaseModel {
  final String purchaseId;
  final String eventId;
  final int quantity;
  final String status;
  final String purchasedAt;
  final EventModel? event;

  const TicketPurchaseModel({
    required this.purchaseId,
    required this.eventId,
    required this.quantity,
    required this.status,
    required this.purchasedAt,
    this.event,
  });

  factory TicketPurchaseModel.fromJson(Map<String, dynamic> json) {
    final ev = json['event'] as Map<String, dynamic>?;
    return TicketPurchaseModel(
      purchaseId: json['purchaseId'] as String,
      eventId: json['eventId'] as String,
      quantity: json['quantity'] as int,
      status: json['status'] as String,
      purchasedAt: json['purchasedAt'] as String,
      event: ev != null ? EventModel.fromJson(ev) : null,
    );
  }
}

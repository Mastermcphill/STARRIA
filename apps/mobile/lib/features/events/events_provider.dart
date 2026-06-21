import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_client.dart';
import 'event_models.dart';

// ── Event list ────────────────────────────────────────────────────────────────

final eventListProvider = FutureProvider.autoDispose<List<EventModel>>((ref) async {
  final dio = ref.watch(dioProvider);
  final res = await dio.get<List<dynamic>>('/events');
  return (res.data ?? [])
      .map((e) => EventModel.fromJson(e as Map<String, dynamic>))
      .toList();
});

// ── Single event ──────────────────────────────────────────────────────────────

final eventDetailProvider =
    FutureProvider.autoDispose.family<EventModel, String>((ref, id) async {
  final dio = ref.watch(dioProvider);
  final res = await dio.get<Map<String, dynamic>>('/events/$id');
  return EventModel.fromJson(res.data!);
});

// ── My tickets ────────────────────────────────────────────────────────────────

final myTicketsProvider =
    FutureProvider.autoDispose<List<TicketPurchaseModel>>((ref) async {
  final dio = ref.watch(dioProvider);
  final res = await dio.get<List<dynamic>>('/events/tickets/me');
  return (res.data ?? [])
      .map((e) => TicketPurchaseModel.fromJson(e as Map<String, dynamic>))
      .toList();
});

// ── Ticket purchase notifier ──────────────────────────────────────────────────

class TicketPurchaseNotifier extends AsyncNotifier<Map<String, dynamic>?> {
  @override
  Future<Map<String, dynamic>?> build() async => null;

  Future<Map<String, dynamic>> purchase({
    required String eventId,
    required String ticketId,
    required String starId,
    int quantity = 1,
  }) async {
    state = const AsyncLoading();
    final dio = ref.read(dioProvider);
    final res = await dio.post<Map<String, dynamic>>(
      '/events/$eventId/tickets/purchase',
      data: {
        'ticketId': ticketId,
        'eventId': eventId,
        'starId': starId,
        'quantity': quantity,
      },
    );
    final data = res.data!;
    state = AsyncData(data);
    return data;
  }
}

final ticketPurchaseProvider =
    AsyncNotifierProvider<TicketPurchaseNotifier, Map<String, dynamic>?>(
        TicketPurchaseNotifier.new);

// ── Live room join notifier ───────────────────────────────────────────────────

class LiveJoinNotifier extends AsyncNotifier<Map<String, dynamic>?> {
  @override
  Future<Map<String, dynamic>?> build() async => null;

  Future<Map<String, dynamic>> join(String eventId) async {
    state = const AsyncLoading();
    final dio = ref.read(dioProvider);
    final res = await dio.post<Map<String, dynamic>>(
      '/live/$eventId/join',
      data: {'role': 'VIEWER'},
    );
    final data = res.data!;
    state = AsyncData(data);
    return data;
  }

  Future<void> leave(String eventId) async {
    final dio = ref.read(dioProvider);
    await dio.post<void>('/live/$eventId/leave');
    state = const AsyncData(null);
  }
}

final liveJoinProvider =
    AsyncNotifierProvider<LiveJoinNotifier, Map<String, dynamic>?>(
        LiveJoinNotifier.new);

// ── Live gift notifier ────────────────────────────────────────────────────────

class LiveGiftNotifier extends AsyncNotifier<Map<String, dynamic>?> {
  @override
  Future<Map<String, dynamic>?> build() async => null;

  Future<Map<String, dynamic>> send({
    required String eventId,
    required String recipientId,
    required String giftType,
    required int coins,
    String? message,
  }) async {
    state = const AsyncLoading();
    final dio = ref.read(dioProvider);
    final res = await dio.post<Map<String, dynamic>>(
      '/live/$eventId/gift',
      data: {
        'recipientId': recipientId,
        'giftType': giftType,
        'coins': coins,
        if (message != null) 'message': message,
      },
    );
    final data = res.data!;
    state = AsyncData(data);
    return data;
  }
}

final liveGiftProvider =
    AsyncNotifierProvider<LiveGiftNotifier, Map<String, dynamic>?>(
        LiveGiftNotifier.new);

// ── Poster generation notifier ────────────────────────────────────────────────

class PosterGenerationNotifier extends AsyncNotifier<Map<String, dynamic>?> {
  @override
  Future<Map<String, dynamic>?> build() async => null;

  Future<Map<String, dynamic>> generate({
    required String title,
    required String eventType,
    String? eventId,
    String? dateTime,
    String style = 'bold',
    String? creatorImageUrl,
  }) async {
    state = const AsyncLoading();
    final dio = ref.read(dioProvider);
    final res = await dio.post<Map<String, dynamic>>(
      '/posters/generate',
      data: {
        'title': title,
        'eventType': eventType,
        if (eventId != null) 'eventId': eventId,
        if (dateTime != null) 'dateTime': dateTime,
        'style': style,
        if (creatorImageUrl != null) 'creatorImageUrl': creatorImageUrl,
      },
    );
    final data = res.data!;
    state = AsyncData(data);
    return data;
  }
}

final posterGenerationProvider =
    AsyncNotifierProvider<PosterGenerationNotifier, Map<String, dynamic>?>(
        PosterGenerationNotifier.new);

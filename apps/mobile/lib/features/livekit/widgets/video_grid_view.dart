import 'package:flutter/material.dart';
import 'package:livekit_client/livekit_client.dart';
import 'participant_tile.dart';

/// Production replacement for the non-functional SmartStageView.
///
/// Two layout modes:
///  * **stage** — the active speaker (or a pinned participant) fills the top
///    ~70%, with the remaining participants in a scrollable filmstrip below.
///  * **grid** — an adaptive NxN grid sized to the participant count.
///
/// The view re-renders whenever the room emits track / speaker / participant
/// change events.
enum StageLayout { stage, grid }

class VideoGridView extends StatefulWidget {
  final Room room;
  final StageLayout layout;
  final String? pinnedIdentity;

  const VideoGridView({
    super.key,
    required this.room,
    this.layout = StageLayout.stage,
    this.pinnedIdentity,
  });

  @override
  State<VideoGridView> createState() => _VideoGridViewState();
}

class _VideoGridViewState extends State<VideoGridView> {
  late final EventsListener<RoomEvent> _listener;

  @override
  void initState() {
    super.initState();
    _listener = widget.room.createListener();
    // Re-render on any event that can change the tile set or speaker order.
    _listener
      ..on<TrackSubscribedEvent>((_) => _refresh())
      ..on<TrackUnsubscribedEvent>((_) => _refresh())
      ..on<TrackMutedEvent>((_) => _refresh())
      ..on<TrackUnmutedEvent>((_) => _refresh())
      ..on<ActiveSpeakersChangedEvent>((_) => _refresh())
      ..on<ParticipantConnectedEvent>((_) => _refresh())
      ..on<ParticipantDisconnectedEvent>((_) => _refresh())
      ..on<RoomReconnectedEvent>((_) => _refresh());
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _listener.dispose();
    super.dispose();
  }

  List<Participant> get _participants {
    final local = widget.room.localParticipant;
    return [
      if (local != null) local,
      ...widget.room.remoteParticipants.values,
    ];
  }

  Participant get _primary {
    final all = _participants;
    if (widget.pinnedIdentity != null) {
      final pinned = all.where((p) => p.identity == widget.pinnedIdentity);
      if (pinned.isNotEmpty) return pinned.first;
    }
    // Active speaker preference.
    final speaking = all.where((p) => p.isSpeaking);
    if (speaking.isNotEmpty) return speaking.first;
    return all.first;
  }

  @override
  Widget build(BuildContext context) {
    final participants = _participants;
    if (participants.isEmpty) {
      return const Center(
        child: Text('Waiting for participants…', style: TextStyle(color: Colors.grey)),
      );
    }

    return widget.layout == StageLayout.grid
        ? _buildGrid(participants)
        : _buildStage(participants);
  }

  // ── Stage layout (primary + filmstrip) ──────────────────────────────────────
  Widget _buildStage(List<Participant> participants) {
    final primary = _primary;
    final others = participants.where((p) => p.sid != primary.sid).toList();

    return Column(
      children: [
        Expanded(
          flex: 7,
          child: Padding(
            padding: const EdgeInsets.all(4),
            child: ParticipantTile(
              participant: primary,
              isLocal: primary.sid == widget.room.localParticipant?.sid,
              fit: BoxFit.cover,
            ),
          ),
        ),
        if (others.isNotEmpty)
          Expanded(
            flex: 3,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 4),
              itemCount: others.length,
              itemBuilder: (context, i) => Padding(
                padding: const EdgeInsets.all(4),
                child: AspectRatio(
                  aspectRatio: 3 / 4,
                  child: ParticipantTile(
                    participant: others[i],
                    isLocal: others[i].sid == widget.room.localParticipant?.sid,
                    showStats: false,
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  // ── Grid layout (adaptive NxN) ──────────────────────────────────────────────
  Widget _buildGrid(List<Participant> participants) {
    final count = participants.length;
    final columns = count <= 1 ? 1 : (count <= 4 ? 2 : (count <= 9 ? 3 : 4));
    return GridView.builder(
      padding: const EdgeInsets.all(4),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: columns,
        childAspectRatio: 3 / 4,
        mainAxisSpacing: 6,
        crossAxisSpacing: 6,
      ),
      itemCount: count,
      itemBuilder: (context, i) => ParticipantTile(
        participant: participants[i],
        isLocal: participants[i].sid == widget.room.localParticipant?.sid,
        showStats: count <= 4,
      ),
    );
  }
}

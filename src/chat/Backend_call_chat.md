# Chat and Call: Implementation Overview

This module provides real-time chat and call capabilities with persistent history, delivery updates, and call lifecycle tracking.

## What This Module Delivers

### Chat Capabilities

- 1:1 and group chat rooms
- Real-time messaging
- Message editing
- Message reactions
- Reply-to-message experience (with preview)
- Forward-message experience (with snapshot preview)
- Per-user message delete behavior
- Attachments (image/pdf)
- Read status and unread counts
- Room pin/unpin support
- User online/offline status
- Typing indicators

### Call Capabilities

- Audio/video call initiation from chat context
- Direct and group-call style participant targeting
- Incoming, accepted, rejected, cancelled, missed, and ended states
- WebRTC signaling relay
- Call history storage
- Recording merge/finalization support and playback/download references

## High-Level Approach

### 1. REST + Realtime Hybrid

- REST is used for durable operations and data retrieval.
- Socket events are used for instant user updates.
- Service layer remains the source of truth for validation and persistence.
- Gateway layer is responsible for live fan-out to users/rooms.

### 2. User and Room Routing Model

- Every connected user has a dedicated personal channel for targeted notifications.
- Every chat room has a dedicated realtime channel for shared events.
- Presence is tracked based on active socket connections.

### 3. Security and Access Control

- Realtime access is token-authenticated.
- Room actions require active participant membership.
- Message-level actions enforce ownership/visibility rules where applicable.

### 4. Consistent Message Envelope

All message updates (new/edit/reaction/listing/last-message) follow a consistent payload shape including:

- base message data
- sender summary
- attachment metadata
- reaction summary
- reply preview block
- forward preview block
- timestamps/readability fields

This keeps UI behavior stable across list, live updates, and notifications.

## Functionality Design Decisions

### Reply Behavior

- Reply references the parent message in the same room.
- Reply preview is included with sender and content summary.
- If referenced content is no longer available, safe placeholders are returned.

### Forward Behavior

- Forward creates a new message in each target room.
- Forward metadata stores original context (sender/time/content snapshot).
- Forward preview is kept stable through snapshot fields to avoid drift if the source changes later.
- Optional note is stored as the forwarded message body.

### Delete Behavior

- Current behavior is per-user hide/delete for messages.
- Original data remains available for authorized participants depending on deletion model.
- Delivery payloads avoid leaking hidden/deleted content when previewing linked messages.

### Reactions and Edit

- Reactions are normalized by emoji with per-user state.
- Edited messages emit realtime updates so all room participants stay in sync.

## Call Lifecycle Approach

### State Progression

- Outgoing call request
- Ringing
- Accepted / Rejected / Missed / Cancelled
- Active call
- Ended

### Reliability Controls

- Ring timeouts auto-close unanswered calls.
- Disconnect handling closes active or pending sessions safely.
- Busy/ringing checks prevent invalid parallel call states.

### Call Logging and Recording

- Call logs are written for each call leg/state transition.
- Recording upload chunks are stabilized, then merged.
- Recording status fields track processing progress.
- Processed recordings expose playable/downloadable URLs.

## Realtime Event Strategy

### Chat Updates

- Room-wide events for shared message state
- User-targeted notifications for personal alerts
- Presence and typing events for collaboration context

### Call Updates

- Targeted events for incoming/outgoing call state changes
- Relay events for signaling payload exchange
- Disconnect-driven cleanup events

## Scalability and Maintainability Notes

- Service logic is centralized to keep business rules consistent between REST and socket paths.
- Repeated message-query patterns are consolidated to reduce drift.
- Metadata-driven previews (reply/forward) reduce frontend branching complexity.
- Call state is tracked in-memory for fast signaling orchestration; call logs persist critical history.

## Integration Expectations

Frontend should treat chat and call streams as event-driven state updates:

- subscribe to room events for shared timeline updates
- subscribe to user events for notifications and call prompts
- reconcile realtime updates with REST pagination/history reads

## Operational Requirements

- Valid JWT auth configuration for API and socket handshake.
- Writable storage for uploads and call recording artifacts.
- `ffmpeg` installed for recording merge pipeline.

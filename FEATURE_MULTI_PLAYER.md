# 🎵 Feature: Multi-Player State Machine System

**Branch:** `feature/multi-player-state-machine`  
**Created:** 2025-10-25  
**Status:** 🚧 In Development

---

## 🎯 Goal

Build a **multi-player radio system** where:
- ✅ Each player has its own state machine
- ✅ Players can be placed in a dashboard
- ✅ Backend can monitor all players via IoT
- ✅ Remote control via IoT commands

---

## 📋 Documentation

All planning and architecture docs are in `/docs/`:
- `RADIO_PLAYER_STATE_MACHINE.md` - IoT architecture
- `STATE_MACHINE_DIAGRAM.md` - State flow diagrams
- `IMPLEMENTATION_PLAN.md` - 7-phase build plan

---

## 🏗️ Implementation Plan

### **Phase 1: Types** (30min)
- [ ] Create `/types/player.ts`
- [ ] Define PlayerState enum
- [ ] Define PlayerConfig, PlayerCommand, etc.

### **Phase 2: IoT Service** (1h)
- [ ] Create `/services/radioPlayerIoT.ts`
- [ ] RadioPlayerIoT class per player instance
- [ ] Subscribe/Publish methods

### **Phase 3: Player Hook** (2h)
- [ ] Create `/hooks/useRadioPlayer.ts`
- [ ] State machine logic
- [ ] Audio handling
- [ ] IoT integration

### **Phase 4: RadioPlayer Component** (3h)
- [ ] Create `/components/RadioPlayer/`
- [ ] Main component
- [ ] Sub-components (Controls, Progress, Timers, etc.)
- [ ] Styling

### **Phase 5: Dashboard** (2h)
- [ ] Create `/pages/DevicesDashboard.tsx`
- [ ] Multi-player grid layout
- [ ] Add/remove players
- [ ] Config management

### **Phase 6: Backend** (2h)
- [ ] Lambda monitoring function
- [ ] DynamoDB storage
- [ ] IoT Rules
- [ ] CloudWatch metrics

### **Phase 7: Testing** (2h)
- [ ] Unit tests
- [ ] Component tests
- [ ] E2E tests

---

## 🚀 Getting Started

Follow the implementation plan in `/docs/IMPLEMENTATION_PLAN.md`

Start with **Phase 1: Types**

---

## 📊 Progress Tracker

| Phase | Status | Time Spent | Notes |
|-------|--------|------------|-------|
| 1. Types | ⬜ Todo | - | - |
| 2. IoT Service | ⬜ Todo | - | - |
| 3. Player Hook | ⬜ Todo | - | - |
| 4. Component | ⬜ Todo | - | - |
| 5. Dashboard | ⬜ Todo | - | - |
| 6. Backend | ⬜ Todo | - | - |
| 7. Testing | ⬜ Todo | - | - |

---

## 🎯 Success Criteria

- [ ] RadioPlayer component works standalone
- [ ] Multiple players in dashboard
- [ ] Each player has unique playerId
- [ ] State changes publish to IoT
- [ ] Backend receives all player states
- [ ] Remote commands work
- [ ] Auto-schedule per hour works
- [ ] Error handling & recovery
- [ ] Full test coverage

---

## 🔗 Related

- Previous work: `feature/iot-dashboard` (merged to main)
- Base player: `/pages/devices/Players.tsx`
- IoT service: `/services/playlistIoT.ts`

---

## 📝 Notes

Will refactor existing Players.tsx to be component-based and add multi-player support.

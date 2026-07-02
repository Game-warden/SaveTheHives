# V50 Automated Validation Protocol (TEST_LOGIC)

## Core Functional Requirements & Grading Rubric

| Feature | Pass Condition | Failure Condition |
| :--- | :--- | :--- |
| **Type Detection** | "Pine" or "Oak" in Note = 🌲 Icon | "Pine" in Note = 🐝 Icon |
| **Status Filter** | Toggle "Warning" OFF = Count Drops | Toggle "Warning" OFF = Count Rises |
| **Note Popup** | Opening Note B closes Note A | Notes A and B both remain visible |
| **Search Sync** | Searching "Test" updates Map + Counter | Searching "Test" only updates Counter |
| **Coordinate Gate** | lng: 0 is excluded from fitBounds | Map zooms out to the entire Earth |

## Execution Hook
After every code write, the Agent must "Self-Audit" by checking the `filteredHives` logic against this criteria.

## Failure Loop
If the Agent detects a "Logic Inversion" (e.g., Count goes UP when filter is OFF), it must re-read the `useMemo` filter and provide a correction immediately.

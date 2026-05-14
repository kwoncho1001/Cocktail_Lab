# Security Specification

## Data Invariants
1. **Recipes**: `title` (string, 1-200 chars), `instructions` (list of strings/objects), `ingredients` (list), `authorId` (matches auth.uid), `createdAt` (server timestamp). `authorId` is immutable.
2. **TastingNotes (Reviews)**: `rating` (number 1-5), `note` (string, max 1000), `recipeId` (matches parent), `userId` (matches auth.uid), `userName` (string).
3. **UserProfile**: `userId` (matches auth.uid), `myBar` (list of ingredient IDs, max 100), `updatedAt` (server timestamp).
4. All IDs must match `^[a-zA-Z0-9_\\-]+$`.
5. Users can only read/write their own UserProfile.
6. Anyone signed in can read recipes and reviews.

## The "Dirty Dozen" Payloads
1. **Create Recipe**: Missing `title`. (Expect: PERMISSION_DENIED)
2. **Create Recipe**: `instructions` is not a list. (Expect: PERMISSION_DENIED)
3. **Create Recipe**: `authorId` does not match `request.auth.uid`. (Expect: PERMISSION_DENIED)
4. **Update Recipe**: Modify `authorId`. (Expect: PERMISSION_DENIED)
5. **Update Recipe**: Modify `createdAt`. (Expect: PERMISSION_DENIED)
6. **Create TastingNote**: `userId` does not match `request.auth.uid`. (Expect: PERMISSION_DENIED)
7. **Update TastingNote**: Modify `userId` to another user's ID. (Expect: PERMISSION_DENIED)
8. **Create UserProfile**: `userId` does not match `request.auth.uid`. (Expect: PERMISSION_DENIED)
9. **Update UserProfile**: Update another user's profile. (Expect: PERMISSION_DENIED)
10. **Update UserProfile**: Set `myBar` to an array > 100 elements. (Expect: PERMISSION_DENIED)
11. **Create Recipe**: Inject "Ghost Field" `isVerified: true`. (Expect: PERMISSION_DENIED)
12. **Get UserProfile**: Read UserProfile that is not yours. (Expect: PERMISSION_DENIED)

## Conflict Report

| Collection | Identity Spoofing | State Shortcutting | Resource Poisoning |
| :--- | :--- | :--- | :--- |
| recipes | Blocked by authorId check | N/A | Blocked by size/type checks |
| reviews | Blocked by userId check | N/A | Blocked by size/type checks |
| users | Blocked by userId == auth.uid | N/A | Blocked by size check on myBar |

## The Test Runner (firestore.rules.test.ts)
```typescript
import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, collection, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import * as fs from 'fs';

// This is a placeholder for real tests if needed in the environment.
// The actual verification will be done via the Red Team Audit logic.
```

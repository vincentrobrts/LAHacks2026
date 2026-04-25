# Architecture

## Product Goal
Turn physics word problems into interactive visualizations.

## MVP Demo
Natural language input creates a projectile-motion visualization where users can adjust variables and launch a projectile into a block tower.

## Final System Flow

User Input
   ↓
Frontend
   ↓
Parser Layer
   ↓
Agentverse Agent / Local Fallback
   ↓
Simulation State JSON
   ↓
Matter.js Visualization
   ↓
Explanation Panel + History

## Core App
Use Next.js + React + TypeScript + Tailwind.

## Physics Engine
Use Matter.js in the frontend.
Do not use PyBullet.
Do not use a separate physics backend for MVP.

## API Routes
Use Next.js API routes if needed:
- POST /api/parse
- POST /api/explain

## Simulation State Schema

{
  "type": "projectile_knockdown",
  "projectile": {
    "speed": 18,
    "angle": 38,
    "mass": 1
  },
  "world": {
    "gravity": 9.8,
    "towerBlocks": 8
  }
}

## History
Use localStorage.
Each saved item stores:
- original prompt
- simulation state
- timestamp

## Sharing
Encode simulation state into URL query params or base64 JSON.
No database for MVP.

## Agentverse
Agentverse is a wrapper around the parser.
It should return the same Simulation State JSON used by the frontend.
The app must still work without Agentverse during demo.
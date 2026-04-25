# Demo Walkthrough

## Scenario
"Use one projectile to knock over the tower."

## Demo Goal
Show that natural language can become an interactive physics visualization.

## Step 1: User Input
User enters:
"Can I knock down the tower with one shot?"

## Step 2: Agent Parsing
Agent returns:

{
  "scenario": "projectile_knockdown",
  "projectile": {
    "start": { "x": 80, "y": 350 },
    "speed": 18,
    "angle": 38
  },
  "target": "block_tower"
}

## Step 3: Visualization
The frontend shows:
- projectile launcher
- block tower
- predicted trajectory arc
- labels for speed, angle, gravity

## Step 4: Interaction
User adjusts:
- launch angle
- projectile speed
- gravity

The arc updates before launch.

## Step 5: Physics Execution
User clicks Launch.
Projectile follows the path and knocks over blocks.

## Step 6: Explanation
Observer panel explains:
- why the projectile hit/missed
- how angle and speed changed the trajectory
- whether the tower was knocked over

## Backup Demo
A “Run Perfect Shot” button loads a preset that always succeeds.
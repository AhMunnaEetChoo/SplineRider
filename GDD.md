# Spline Rider Overview

Spline rider is a simple game built around quick playtimes and easy level editing.
splines are placed in the environment
there is a start point and end goal. The player spawns at the start and must make their way to the goal as fast as they can. If the player falls off the bottom of the map it's gameover and they restart.

## riding splines
the player is essentially a particle that 'rides' the spline with only 2 movement options, forwards and backwards. When on a spline forward will accelerate the player to the right and backwards will accelerate to the left. however, speed on the spline is maintained modelling only a small amount of drag. This means if the spline turns from pointing right to pointing left the player must change directions midway to keep accelerating. Gravity always acts downwards on the player. The player will accelerate down splines faster and decellerate when travelling upwards.

## launching from splines
when reaching the end of the spline the player is launched - keeping the same exact spline tangent velocity at the end point of the spline.
the player can also launch from the spline at any time by pressing both directions at the same time.

## player in free flight (not riding spline)
When the player is launched and free from the spline gravity acts freely accelerating player downward. the player still has some acceleration left and right but it is modified to be weaker. there is air drag.



## Level editor
a new level can be made with simple click and drag controls. Splines control points can be added and removed. New splines created. start and end points can be dragged around. the level can be saved to a level list
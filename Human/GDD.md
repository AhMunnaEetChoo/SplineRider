# Spline Rider Overview

Spline rider is a simple game built around quick playtimes and easy level editing.
splines are placed in the environment
there is a start point and end goal. The player spawns at the start and must make their way to the goal as fast as they can. If the player falls off the bottom of the map it's gameover and they restart.

# Core pillars
Easy to pick up and play.
    - minimal tutorials and text
    - Immediate, tiny load times, instant restart
    - One button game, anyone can play this game and it's intuitive as to what the button press does

Broad reach
    - mobile web application, no hardware strain
    - free
    - easy to share levels created

Minimal but stylish
    - Theme and art style make it distinct and unmistakenly the only game like this


## riding splines
the player is essentially a particle that 'rides' the spline with only 2 movement options:
- accelerate on spline
- freeflight (pass through / fall off spline)

 When on a spline the player accelerates along the vector it joined the spline. Speed on the spline is maintained modelling only a small amount of drag.
 
 Gravity always acts downwards on the player. This way the player will accelerate down splines faster and slower when travelling upwards.

## launching from splines
when reaching the end of the spline the player is launched - keeping the same exact spline tangent velocity at the end point of the spline.
the same is true when travelling backward off the spine start point.
the player can also launch from the spline at any time by letting go of the button.

## attaching to splines
when a player is in free flight and within a small radius of a spline AND the players trajectory lines up with the next splines tangent within a large tolerance the player will snap to the new spline continuing their dot prod speed along the new tangent. If the player is holding both directions (left and right) no attachment occurs.

## player in free flight (not riding spline)
When the player is launched and free from the spline gravity acts freely accelerating player downward. the player still has some acceleration left and right but it is modified to be weaker. there is air drag.



## Level editor
a new level can be made with simple click and drag controls. Splines control points can be added and removed. New splines created. start and end points can be dragged around. the level can be saved to a level list
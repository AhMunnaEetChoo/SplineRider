
# Ideation

## springyness

if we hit the spline at an angle the lateral component converts to springyness
letting go during the first return spring should shoot us backwards at most with the same velocity

if we hit close to perpendicular we will start travelling up the spline and springyness well be less than a perpendicular hit simply because of the divide of proportions - part of the momentum is converted to instand tangential speed, the other to the lateral component that runs on a spring.

We do NOT want to model an actualy rubber / rope simulation as this is complicated, harder to tune, and gives the player less control - they will find it harder to reason about what will happen when they attach to a specific shape along a spline.

springyness feels lovely and natural, ripples travel up the spline chain. each spline node tries to keep it's original separation with neighbours but also it's original separation with starting point. There IS a rope simulation here but it's only visual, under the hood the spline is a fixed shape and the model is a simple spring displacement from spline attach point


### half-baked ideas that change the design
holding while hitting the end point of a spline causes a spring but along the tangent. this encourages skill for the player to release just as they hit spline end

Is springyness always in effect? as the player curves and turns perhaps some of this energy goes into springing the cables out?

### springy visuals?
sparks are always good. ghost dark drawnings of previous frames help player recall original shape

# Issues and design ideas To Break Down

- the spline rendering appears to join different splines with a straight line. This isn't desireable, we want to be able to draw many disconnected splines.
- catmul-rom splines are better for this game as they're more intuitive to draw. Do a pass improving the spline and editing tools
- when we click to create a new spline it's made near the very button we clicked. Instead what we want is a spline to start being made if we click in empty space
- there seems no way to grab and scroll the level in the editor. this is necessary.
- we should plan a new input method, while holding touch we stay on the spline, our velocity vecctor is relative to the position that touch was first held such that we have full 2d angular control. Draw some arrows showing this.
- we should plan a way of hosting level data and displaying a selectable level list
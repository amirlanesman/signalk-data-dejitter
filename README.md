# signalk-data-dejitter
SignalK plugin to provide data de-jittering.  The plugin receives deltas from SignalK and averages them according to settings.

## Configuring de-jitter
For each value you want to de-jitter you will have to set the following:

- Path of delta to de-jitter
- Path of new de-jittered data to generate
- Number of frames to aggregate at a time
- Type of calculation to use: 
    - Average (returns the average of the frames received)
    - Min (returns the lowest of the frames received)
    - Max (returns the heighest of the frames received)
    - RadialAverage (Averages the frames for a value which uses degrees)
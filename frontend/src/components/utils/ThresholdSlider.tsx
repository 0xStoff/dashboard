import React from 'react';
import { Typography, Slider, Box } from '@mui/material';
import { toFixedString } from "../../utils/number-utils";

interface ThresholdSliderProps {
    value: number;
    onChange: (event: Event, newValue: number | number[]) => void;
    min: number;
    max: number;
    label?: string;  // Add label prop
}

const ThresholdSlider: React.FC<ThresholdSliderProps> = ({ value, onChange, min, max, label }) => {
    return (
        <Box sx={{ marginBottom: 3, position: 'relative' }}>
            {/* Add label for slider */}
            {label && (
                <Typography variant="body1" gutterBottom>
                    {label}
                </Typography>
            )}

            <Box sx={{ paddingY: 2 }}>
                <Slider
                    value={value}
                    onChange={onChange}
                    min={min}
                    max={max}
                    step={1}
                    valueLabelDisplay="auto"  // Keep tooltip visible during interaction
                    aria-labelledby="threshold-slider"
                    sx={{ width: 300 }}
                />
            </Box>

            {/* Display the current threshold */}
            <Typography variant="body2" color="textSecondary">
                Current Threshold: $ {toFixedString(value)}
            </Typography>
        </Box>
    );
};

export default ThresholdSlider;
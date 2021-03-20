import TextField from '@material-ui/core/TextField';
import Box from '@material-ui/core/Box';
import { unstable_useId as useId } from '@material-ui/core/utils';
import MuiDateRangePicker from '@material-ui/lab/DateRangePicker';
import type { DateRange } from '@material-ui/lab/DateRangePicker';

type DateRangePickerProps = {
  value: DateRange<Date>;
  onChange: (value: DateRange<Date>) => void;
};

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const id = useId();

  return (
    <MuiDateRangePicker
      value={value}
      onChange={onChange}
      renderInput={(startProps, endProps) => (
        <>
          <TextField {...startProps} variant="standard" id={`${id}-start`} />
          <Box sx={{ mx: 2 }}> to </Box>
          <TextField {...endProps} variant="standard" id={`${id}-end`} />
        </>
      )}
    />
  );
}

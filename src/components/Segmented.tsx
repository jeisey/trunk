import { useId } from 'react';

export interface SegmentOption<T extends string | number> {
  value: T;
  label: string;
}

/** A labelled radio group styled as a segmented control. Arrow keys work natively. */
export function Segmented<T extends string | number>(props: {
  legend: string;
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  hideLegend?: boolean;
}) {
  const id = useId();
  return (
    <div className="segmented" role="radiogroup" aria-labelledby={id}>
      <span id={id} className={props.hideLegend ? 'visually-hidden' : 'seg-label'}>
        {props.legend}
      </span>
      <div className="segments">
        {props.options.map((o) => (
          <label key={String(o.value)}>
            <input type="radio" name={id} value={String(o.value)} checked={o.value === props.value} onChange={() => props.onChange(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}

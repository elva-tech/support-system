import { Component, forwardRef, input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HEX_COLOR_PATTERN } from '../../../core/portal/default-branding';

const PRESETS = [
  { label: 'Navy', value: '#13294b' },
  { label: 'Blue', value: '#1d4ed8' },
  { label: 'Indigo', value: '#4338ca' },
  { label: 'Purple', value: '#7e22ce' },
  { label: 'Green', value: '#15803d' },
  { label: 'Teal', value: '#0f766e' },
  { label: 'Orange', value: '#c2410c' },
  { label: 'Red', value: '#b91c1c' },
  { label: 'Pink', value: '#be185d' },
  { label: 'Gray', value: '#475569' }
] as const;

/**
 * Shared branding color editor used by Workspace Settings and Setup.
 */
@Component({
  selector: 'app-brand-color-picker',
  standalone: true,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => BrandColorPickerComponent),
      multi: true
    }
  ],
  template: `
    <div class="space-y-2">
      @if (label()) {
        <label class="form-label">{{ label() }}</label>
      }
      <div class="flex flex-wrap items-center gap-2">
        <input
          type="color"
          class="h-10 w-12 cursor-pointer rounded border border-slate-300"
          [value]="pickerValue"
          (input)="onPicker($event)"
          [disabled]="disabled"
        />
        <input
          class="form-input max-w-[10rem]"
          [value]="value"
          (input)="onHex($event)"
          placeholder="#13294b"
          [disabled]="disabled"
        />
      </div>
      <div class="flex flex-wrap gap-2 pt-1">
        @for (p of presets; track p.value) {
          <button
            type="button"
            class="h-7 w-7 rounded-full border border-slate-200 shadow-sm transition ring-offset-1 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-slate-400"
            [style.background-color]="p.value"
            [attr.title]="p.label"
            [attr.aria-label]="p.label"
            [disabled]="disabled"
            (click)="select(p.value)"
          ></button>
        }
      </div>
    </div>
  `
})
export class BrandColorPickerComponent implements ControlValueAccessor {
  readonly label = input('');
  readonly presets = PRESETS;

  value = '';
  disabled = false;
  private onChange: (v: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  get pickerValue(): string {
    return HEX_COLOR_PATTERN.test(this.value) && this.value.length === 7 ? this.value : '#13294b';
  }

  writeValue(value: string | null): void {
    this.value = value || '';
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onPicker(event: Event): void {
    const v = (event.target as HTMLInputElement).value;
    this.select(v);
  }

  onHex(event: Event): void {
    const v = (event.target as HTMLInputElement).value.trim();
    this.value = v;
    this.onChange(v);
    this.onTouched();
  }

  select(hex: string): void {
    this.value = hex;
    this.onChange(hex);
    this.onTouched();
  }
}

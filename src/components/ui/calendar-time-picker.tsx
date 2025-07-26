'use client'
import * as React from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface CalendarTimePickerProps {
  /** Current value as ISO string */
  value: string
  /** Called with new ISO string when selection changes */
  onChange: (value: string) => void
}

export function CalendarTimePicker({ value, onChange }: CalendarTimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const date = new Date(value)

  const handleDateSelect = (d?: Date) => {
    if (!d) return
    const newDate = new Date(d)
    newDate.setHours(date.getHours(), date.getMinutes(), date.getSeconds(), 0)
    onChange(newDate.toISOString())
    setOpen(false)
  }

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [h, m, s] = e.target.value.split(':').map((n) => parseInt(n, 10))
    const newDate = new Date(date)
    newDate.setHours(h || 0, m || 0, s || 0, 0)
    onChange(newDate.toISOString())
  }

  return (
    <div className="flex gap-4">
      <div className="flex flex-col gap-3">
        <Label htmlFor="date-picker" className="px-1">
          Date
        </Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" id="date-picker" className="w-32 justify-between font-normal">
              {date.toLocaleDateString()}
              <ChevronDownIcon />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto overflow-hidden p-0" align="start">
            <Calendar mode="single" selected={date} captionLayout="dropdown" onSelect={handleDateSelect} />
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex flex-col gap-3">
        <Label htmlFor="time-picker" className="px-1">
          Time
        </Label>
        <Input
          type="time"
          id="time-picker"
          step="1"
          value={date.toTimeString().slice(0, 8)}
          onChange={handleTimeChange}
          className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
        />
      </div>
    </div>
  )
}

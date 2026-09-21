import { useState } from 'react';
import {
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { DURATION_UNITS, secondsToUnitValue, toSeconds, type DurationUnit } from '@shared/duration';
import { thresholdOrderingIssues } from '@shared/schemas';
import type { TaskDto } from '@shared/types';
import { ApiRequestError } from '../api/client';
import { useCreateTaskMutation, useUpdateTaskMutation } from '../hooks/useTasks';
import { ThresholdPreview } from './ThresholdPreview';

const UNIT_OPTIONS = DURATION_UNITS.map((unit) => ({ value: unit, label: unit }));

interface CadencePreset {
  label: string;
  value: number;
  unit: DurationUnit;
}

const CADENCE_PRESETS: CadencePreset[] = [
  { label: 'Daily', value: 1, unit: 'days' },
  { label: 'Weekly', value: 1, unit: 'weeks' },
  { label: 'Fortnightly', value: 2, unit: 'weeks' },
  { label: 'Monthly', value: 1, unit: 'months' },
  { label: 'Quarterly', value: 3, unit: 'months' },
  { label: 'Annual', value: 12, unit: 'months' },
];

interface TaskFormValues {
  name: string;
  description: string;
  dueValue: number;
  dueUnit: DurationUnit;
  overdueValue: number;
  overdueUnit: DurationUnit;
  urgentValue: number;
  urgentUnit: DurationUnit;
}

function defaultValues(task: TaskDto | undefined): TaskFormValues {
  if (!task) {
    return {
      name: '',
      description: '',
      dueValue: 1,
      dueUnit: 'days',
      overdueValue: 2,
      overdueUnit: 'days',
      urgentValue: 4,
      urgentUnit: 'days',
    };
  }

  const due = secondsToUnitValue(task.dueAfterSeconds);
  const overdue = secondsToUnitValue(task.overdueAfterSeconds);
  const urgent = secondsToUnitValue(task.urgentAfterSeconds);

  return {
    name: task.name,
    description: task.description,
    dueValue: due.value,
    dueUnit: due.unit,
    overdueValue: overdue.value,
    overdueUnit: overdue.unit,
    urgentValue: urgent.value,
    urgentUnit: urgent.unit,
  };
}

function toNumber(value: number | string): number {
  return typeof value === 'number' ? value : Number(value) || 0;
}

const API_FIELD_TO_FORM_FIELD: Record<string, keyof TaskFormValues> = {
  name: 'name',
  description: 'description',
  dueAfterSeconds: 'dueValue',
  overdueAfterSeconds: 'overdueValue',
  urgentAfterSeconds: 'urgentValue',
};

interface ThresholdFieldProps {
  label: string;
  value: number;
  unit: DurationUnit;
  error?: string;
  onValueChange: (value: number | string) => void;
  onUnitChange: (unit: string | null) => void;
}

function ThresholdField({
  label,
  value,
  unit,
  error,
  onValueChange,
  onUnitChange,
}: ThresholdFieldProps) {
  return (
    <Group align="flex-start" wrap="nowrap">
      <NumberInput
        label={label}
        min={0}
        value={value}
        onChange={onValueChange}
        error={error}
        style={{ flex: 1 }}
      />
      <Select
        aria-label={`${label} unit`}
        data={UNIT_OPTIONS}
        value={unit}
        onChange={onUnitChange}
        allowDeselect={false}
        w={130}
        mt={25}
      />
    </Group>
  );
}

interface TaskFormFieldsProps {
  task: TaskDto | undefined;
  onClose: () => void;
}

function TaskFormFields({ task, onClose }: TaskFormFieldsProps) {
  const isEdit = task !== undefined;
  const createMutation = useCreateTaskMutation();
  const updateMutation = useUpdateTaskMutation();

  // Auto-fill only applies while the user hasn't directly edited overdue or
  // urgent. In edit mode both already carry real values, so a due-field
  // edit must never clobber them.
  const [overdueTouched, setOverdueTouched] = useState(isEdit);
  const [urgentTouched, setUrgentTouched] = useState(isEdit);

  const form = useForm<TaskFormValues>({
    initialValues: defaultValues(task),
    validateInputOnChange: true,
    validate: (values) => {
      const errors: Record<string, string> = {};

      const trimmedName = values.name.trim();
      if (trimmedName.length === 0) {
        errors.name = 'Name is required';
      } else if (trimmedName.length > 200) {
        errors.name = 'Name must be 200 characters or fewer';
      }

      if (!(values.dueValue > 0)) errors.dueValue = 'Must be greater than 0';
      if (!(values.overdueValue > 0)) errors.overdueValue = 'Must be greater than 0';
      if (!(values.urgentValue > 0)) errors.urgentValue = 'Must be greater than 0';

      if (!errors.dueValue && !errors.overdueValue && !errors.urgentValue) {
        const issues = thresholdOrderingIssues({
          dueAfterSeconds: toSeconds(values.dueValue, values.dueUnit),
          overdueAfterSeconds: toSeconds(values.overdueValue, values.overdueUnit),
          urgentAfterSeconds: toSeconds(values.urgentValue, values.urgentUnit),
        });
        for (const issue of issues) {
          errors[issue.path === 'overdueAfterSeconds' ? 'overdueValue' : 'urgentValue'] =
            issue.message;
        }
      }

      return errors;
    },
  });

  // Manual value/onChange (rather than form.getInputProps) is what lets
  // these handlers also drive the auto-fill and touched-tracking below, but
  // it means Mantine's own validateInputOnChange never fires for these
  // fields — so each handler re-validates explicitly.

  function handleDueValueChange(value: number | string) {
    const numeric = toNumber(value);
    form.setFieldValue('dueValue', numeric);
    if (!overdueTouched) form.setFieldValue('overdueValue', numeric * 2);
    if (!urgentTouched) form.setFieldValue('urgentValue', numeric * 4);
    form.validate();
  }

  function handleDueUnitChange(unit: string | null) {
    if (!unit) return;
    form.setFieldValue('dueUnit', unit as DurationUnit);
    if (!overdueTouched) form.setFieldValue('overdueUnit', unit as DurationUnit);
    if (!urgentTouched) form.setFieldValue('urgentUnit', unit as DurationUnit);
    form.validate();
  }

  function handleOverdueValueChange(value: number | string) {
    setOverdueTouched(true);
    form.setFieldValue('overdueValue', toNumber(value));
    form.validate();
  }

  function handleOverdueUnitChange(unit: string | null) {
    if (!unit) return;
    setOverdueTouched(true);
    form.setFieldValue('overdueUnit', unit as DurationUnit);
    form.validate();
  }

  function handleUrgentValueChange(value: number | string) {
    setUrgentTouched(true);
    form.setFieldValue('urgentValue', toNumber(value));
    form.validate();
  }

  function handleUrgentUnitChange(unit: string | null) {
    if (!unit) return;
    setUrgentTouched(true);
    form.setFieldValue('urgentUnit', unit as DurationUnit);
    form.validate();
  }

  function applyPreset(preset: CadencePreset) {
    form.setFieldValue('dueValue', preset.value);
    form.setFieldValue('dueUnit', preset.unit);
    form.setFieldValue('overdueValue', preset.value * 2);
    form.setFieldValue('overdueUnit', preset.unit);
    form.setFieldValue('urgentValue', preset.value * 4);
    form.setFieldValue('urgentUnit', preset.unit);
    setOverdueTouched(false);
    setUrgentTouched(false);
    form.validate();
  }

  function handleSubmit(values: TaskFormValues) {
    const input = {
      name: values.name.trim(),
      description: values.description,
      dueAfterSeconds: toSeconds(values.dueValue, values.dueUnit),
      overdueAfterSeconds: toSeconds(values.overdueValue, values.overdueUnit),
      urgentAfterSeconds: toSeconds(values.urgentValue, values.urgentUnit),
    };

    const promise =
      isEdit && task
        ? updateMutation.mutateAsync({ id: task.id, input })
        : createMutation.mutateAsync(input);

    promise
      .then(() => onClose())
      .catch((err: unknown) => {
        if (err instanceof ApiRequestError && err.field && API_FIELD_TO_FORM_FIELD[err.field]) {
          form.setFieldError(API_FIELD_TO_FORM_FIELD[err.field], err.message);
        } else {
          notifications.show({ color: 'red', message: 'Could not save task. Please try again.' });
        }
      });
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack>
        <TextInput label="Name" required {...form.getInputProps('name')} />
        <Textarea label="Description" minRows={2} {...form.getInputProps('description')} />

        <Stack gap={4}>
          <Text size="sm" fw={500}>
            Cadence presets
          </Text>
          <Group gap="xs">
            {CADENCE_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant="default"
                size="xs"
                onClick={() => applyPreset(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </Group>
        </Stack>

        <ThresholdField
          label="Due after"
          value={form.values.dueValue}
          unit={form.values.dueUnit}
          error={form.errors.dueValue as string | undefined}
          onValueChange={handleDueValueChange}
          onUnitChange={handleDueUnitChange}
        />
        <ThresholdField
          label="Overdue after"
          value={form.values.overdueValue}
          unit={form.values.overdueUnit}
          error={form.errors.overdueValue as string | undefined}
          onValueChange={handleOverdueValueChange}
          onUnitChange={handleOverdueUnitChange}
        />
        <ThresholdField
          label="Urgent after"
          value={form.values.urgentValue}
          unit={form.values.urgentUnit}
          error={form.errors.urgentValue as string | undefined}
          onValueChange={handleUrgentValueChange}
          onUnitChange={handleUrgentUnitChange}
        />

        <Text size="xs" c="dimmed">
          Weeks are always 7 days and months are always 30 days — not calendar arithmetic.
        </Text>

        <ThresholdPreview
          dueAfterSeconds={toSeconds(form.values.dueValue, form.values.dueUnit)}
          overdueAfterSeconds={toSeconds(form.values.overdueValue, form.values.overdueUnit)}
          urgentAfterSeconds={toSeconds(form.values.urgentValue, form.values.urgentUnit)}
        />

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSaving}>
            {isEdit ? 'Save' : 'Create'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

interface TaskFormModalProps {
  opened: boolean;
  onClose: () => void;
  task?: TaskDto;
}

export function TaskFormModal({ opened, onClose, task }: TaskFormModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={task ? 'Edit task' : 'Add task'} size="md">
      {/* Gated on `opened` (not left to Modal's own unmount-on-close timing)
          so every open gets a fresh useForm instance seeded from the
          current task — no effect needed to "reset" stale form state. */}
      {opened && <TaskFormFields task={task} onClose={onClose} />}
    </Modal>
  );
}

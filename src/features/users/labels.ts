/**
 * USER ROLE LABELS AND CONSTANTS
 *
 * Centralized display labels and descriptions for user roles.
 */

import type { UserRole } from './types';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Администратор',
  manager: 'Менеджер',
  mechanic: 'Механик',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'Полный доступ к системе',
  manager: 'Управление операциями и выплатами',
  mechanic: 'Обслуживание и инспекции',
};

export const ROLE_VARIANTS = {
  admin: 'default' as const,
  manager: 'secondary' as const,
  mechanic: 'outline' as const,
};

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: [
    'Управление пользователями и членами команды',
    'Полный доступ ко всем функциям',
    'Настройка параметров системы',
    'Просмотр и управление выплатами',
    'Управление всеми операциями',
  ],
  manager: [
    'Управление велосипедами, курьерами и назначениями',
    'Просмотр и управление выплатами',
    'Утверждение запросов на обслуживание',
    'Отслеживание расходов',
    'Создание отчетов',
  ],
  mechanic: [
    'Просмотр назначенных задач обслуживания',
    'Обновление статуса обслуживания',
    'Запись инспекций',
    'Просмотр информации о велосипедах',
  ],
};

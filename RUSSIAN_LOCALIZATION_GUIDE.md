# Russian Localization Implementation Guide

## ✅ Completed

### 1. Core Infrastructure
- **next-intl** installed and configured
- `src/i18n/request.ts` - i18n configuration (Russian default)
- `src/messages/ru.json` - Comprehensive Russian translations
- `next.config.js` - Updated with next-intl plugin
- `src/lib/utils/i18n.ts` - Translation helper utilities with Russian pluralization

### 2. Formatting & Locale
- `src/lib/utils/format.ts` - Updated to use `ru-RU` locale
  - Numbers: `1 234,50` (space separator, comma decimal)
  - Dates: `23 июл. 2024 г.` (Russian format)
  - Short dates: `23.07.2024` (DD.MM.YYYY)
  - Relative time: "1 минуту назад", "через 1 день"

### 3. Label Files
- `src/features/earnings/labels.ts` - Russian labels for earnings
- `src/features/users/labels.ts` - Russian labels for roles
- `src/features/maintenance/labels.ts` - Russian labels for maintenance
- `src/lib/constants/navigation.ts` - Russian navigation labels

---

## 📋 Implementation Approach

### Method 1: Using Translations in Components

#### Server Components
```tsx
import { getTranslations } from 'next-intl/server';

export default async function Page() {
  const t = await getTranslations('earnings');
  
  return <h1>{t('title')}</h1>;
}
```

#### Client Components
```tsx
'use client';
import { useTranslations } from 'next-intl';

export function Component() {
  const t = useTranslations('earnings');
  
  return <button>{t('addIncome')}</button>;
}
```

### Method 2: Direct Label Updates (Faster for Static Text)

For components with hardcoded strings, replace directly:
```tsx
// Before
<Button>Add Income</Button>

// After
<Button>Добавить доход</Button>
```

---

## 🔄 Translation Patterns

### 1. Russian Pluralization

Russian has **3 plural forms** (not 2 like English):

```tsx
import { formatCount } from '@/lib/utils/i18n';

// 1 велосипед
// 2 велосипеда
// 5 велосипедов
formatCount(count, 'велосипед', 'велосипеда', 'велосипедов');
```

**Rules:**
- **one**: 1, 21, 31, 41, ... (ends in 1, except 11)
- **few**: 2-4, 22-24, 32-34, ... (ends in 2-4, except 12-14)
- **many**: 5-20, 25-30, ... (everything else)

### 2. Interpolated Strings

```tsx
// In translations
{
  "message": "Курьеру {name} выплачено {amount}"
}

// In code
t('message', { name: 'Иван', amount: formatCurrency(1500) })
// → "Курьеру Иван выплачено 1 500,00"
```

### 3. Date Ranges

```tsx
// Format period
`${formatDate(period.period_start)} – ${formatDate(period.period_end)}`
// → "12 авг. 2026 г. – 26 авг. 2026 г."
```

---

## 📝 Component Translation Checklist

For each component, translate:

### UI Text
- [ ] Page titles and headings
- [ ] Button labels (Add, Edit, Delete, Save, Cancel)
- [ ] Form field labels
- [ ] Placeholders
- [ ] Helper text
- [ ] Empty states ("No data", "Create first...")

### Status & Badges
- [ ] Status labels (Draft, Approved, Paid)
- [ ] Type labels (Repair, Inspection, etc.)
- [ ] Condition labels (Excellent, Good, Fair, Poor)

### Messages
- [ ] Success toasts
- [ ] Error messages
- [ ] Confirmation dialogs
- [ ] Warning alerts

### Tables
- [ ] Column headers
- [ ] Action button labels
- [ ] Search placeholders
- [ ] "Found X of Y" messages

---

## 🎯 Priority Translation Order

### Phase 1: Critical User Flows ✅
1. ✅ Navigation
2. ✅ Label files (earnings, users, maintenance)
3. ✅ Date/currency formatting
4. 🔄 Authentication pages (login/signup)
5. 🔄 Earnings management (highest priority)

### Phase 2: Core Features
6. Bikes management
7. Couriers management
8. Assignments
9. Rental plans

### Phase 3: Supporting Features
10. Maintenance & inspections
11. Team management
12. Dashboard

### Phase 4: Polish
13. Error pages (404, 500)
14. Loading states
15. Validation messages
16. Toast notifications

---

## 🛠️ Quick Translation Script

To speed up translation, use this pattern:

```tsx
// 1. Import at top
import { useTranslations } from 'next-intl';

// 2. Get translation function
const t = useTranslations('namespace');

// 3. Replace strings
<Button>{t('action')}</Button>
```

---

## 🔍 Finding Hardcoded Strings

Search patterns to find untranslated text:
```bash
# Find button text
grep -r "\"Add" src/components --include="*.tsx"

# Find placeholders
grep -r "placeholder=" src/components --include="*.tsx"

# Find validation messages
grep -r "required\|invalid\|must be" src/features --include="*.ts"
```

---

## ⚠️ Common Issues

### 1. Long Russian Text
Russian text is typically **15-30% longer** than English.

**Solutions:**
- Use shorter button labels on mobile
- Increase column widths
- Use tooltips for long labels
- Wrap text in cards

### 2. Pluralization Errors
```tsx
// ❌ Wrong (English pluralization)
`${count} deduction${count !== 1 ? 's' : ''}`

// ✅ Correct (Russian pluralization)
formatCount(count, 'удержание', 'удержания', 'удержаний')
```

### 3. Date Format Confusion
```tsx
// ❌ Wrong
new Date().toLocaleDateString() // Uses browser locale

// ✅ Correct
formatDate(new Date()) // Uses ru-RU consistently
```

---

## 📦 Translation File Structure

```
src/
  messages/
    ru.json          ← All Russian translations
  i18n/
    request.ts       ← i18n configuration
  lib/
    utils/
      format.ts      ← Locale-aware formatting
      i18n.ts        ← Translation utilities
```

---

## 🚀 Next Steps

1. **Update Layout Files** - Wrap app with NextIntlClientProvider
2. **Translate Auth Pages** - Login, signup, password reset
3. **Translate Earnings Components** - All forms, lists, buttons
4. **Translate Other Features** - Bikes, couriers, assignments, etc.
5. **Test UI** - Check for layout issues with longer Russian text
6. **Add Missing Translations** - Fill gaps as you find them

---

## 📚 Resources

- **next-intl docs**: https://next-intl-docs.vercel.app/
- **Russian pluralization**: https://unicode-org.github.io/cldr-staging/charts/latest/supplemental/language_plural_rules.html#ru
- **Intl.NumberFormat (ru-RU)**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat

---

## 🎨 UI Text Length Guide

| English | Russian | Length Increase |
|---------|---------|-----------------|
| Add | Добавить | +100% |
| Edit | Редактировать | +200% |
| Delete | Удалить | +100% |
| Save | Сохранить | +125% |
| Cancel | Отмена | +20% |
| Approve | Утвердить | +125% |
| Mark as Paid | Отметить как оплачено | +140% |

Plan for **20-30% more space** in buttons and columns.

---

**Status**: Core infrastructure complete. Ready for component-by-component translation.

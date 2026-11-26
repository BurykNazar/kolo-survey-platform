// Тонкий шар сумісності: реалізація живе в ./validation/.
export { TYPES, STATUSES, str, isEmail, passwordProblem, safeReturnTo, parseId, parseDateInput } from './validation/core.js';
export { validateSurveyInput } from './validation/survey.js';
export { validateQuestionInput, validateOptionInput, validateCategoryInput } from './validation/question.js';
export { validateUserInput, validateRegistration, validateProfileInput } from './validation/user.js';
export { validateAnswers } from './validation/answers.js';

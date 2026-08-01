function createSession_(staff, deviceReference) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sessionMinutes = getSecurityConfigNumber_(spreadsheet, 'SESSION_MINUTES', 30);
  var idleMinutes = getSecurityConfigNumber_(spreadsheet, 'IDLE_MINUTES', 15);
  var sessionId = Utilities.getUuid();
  var token = randomToken_();
  var salt = Utilities.getUuid();
  var now = new Date();
  putExpiringSecret_('SESSION', sessionId, {
    tokenHash: secureHash_(token, salt), salt: salt, staffId: staff.StaffID, roleKey: staff.RoleKey,
    deviceReference: deviceReference || '', createdAt: now.toISOString(), lastActivityAt: now.toISOString(),
    absoluteExpiresAt: new Date(now.getTime() + sessionMinutes * 60000).toISOString(), idleMinutes: idleMinutes,
    context: null,
  }, new Date(now.getTime() + sessionMinutes * 60000));
  return { sessionId: sessionId, sessionToken: token, expiresInSeconds: sessionMinutes * 60, idleSeconds: idleMinutes * 60 };
}

function validateSession(sessionId, sessionToken) {
  var requestId = createRequestId_();
  try {
    var session = requireSession_(sessionId, sessionToken, true);
    return createApiResult_(true, requestId, sanitizeSession_(session));
  } catch (error) {
    return createApiResult_(false, requestId, null, 'SESSION_INVALID');
  }
}

function requireSession_(sessionId, sessionToken, touch) {
  var session = getExpiringSecret_('SESSION', sessionId);
  if (!session || !constantTimeEqual_(secureHash_(sessionToken, session.salt), session.tokenHash)) throw new Error('SESSION_INVALID');
  var now = Date.now();
  if (new Date(session.absoluteExpiresAt).getTime() <= now || new Date(session.lastActivityAt).getTime() + session.idleMinutes * 60000 <= now) {
    deleteSecret_('SESSION', sessionId);
    throw new Error('SESSION_EXPIRED');
  }
  if (touch) {
    session.lastActivityAt = new Date(now).toISOString();
    putExpiringSecret_('SESSION', sessionId, session, new Date(session.absoluteExpiresAt));
  }
  return session;
}

function revokeSession_(sessionId) {
  deleteSecret_('SESSION', sessionId);
}

function sanitizeSession_(session) {
  return { staffId: session.staffId, roleKey: session.roleKey, context: session.context, absoluteExpiresAt: session.absoluteExpiresAt };
}

function setTeacherContext(sessionId, sessionToken, context) {
  var requestId = createRequestId_();
  try {
    var session = requireSession_(sessionId, sessionToken, false);
    if (session.roleKey !== 'TEACHER') throw new Error('ROLE_NOT_ALLOWED');
    if (!context || HEALTH_V5_SECURITY.validContexts.indexOf(context.type) === -1 || !context.scopeId) throw new Error('INVALID_CONTEXT');
    if (!validateTeacherContextScope_(session.staffId, context.type, String(context.scopeId))) throw new Error('CONTEXT_SCOPE_DENIED');
    session.context = { type: context.type, scopeId: String(context.scopeId), selectedAt: new Date().toISOString() };
    putExpiringSecret_('SESSION', sessionId, session, new Date(session.absoluteExpiresAt));
    return createApiResult_(true, requestId, { context: session.context });
  } catch (error) {
    return createApiResult_(false, requestId, null, 'CONTEXT_REJECTED');
  }
}

function validateTeacherContextScope_(staffId, contextType, scopeId) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var cache = buildIntegrityCache_(spreadsheet);
  var now = Date.now();
  var assignmentMatch = cache.AssignmentDB.some(function (record) {
    if (record.StaffID !== staffId || record.RecordStatus !== 'ACTIVE') return false;
    if (record.AssignmentType !== contextType || record.ScopeID !== scopeId) return false;
    if (record.StartsAt && new Date(record.StartsAt).getTime() > now) return false;
    if (record.EndsAt && new Date(record.EndsAt).getTime() < now) return false;
    return true;
  });
  if (assignmentMatch) return true;
  if (contextType !== 'DUTY') return false;
  var today = Utilities.formatDate(new Date(), HEALTH_V5_FOUNDATION.timezone, 'yyyy-MM-dd');
  return cache.DutyDB.some(function (record) {
    return record.StaffID === staffId && record.ScopeID === scopeId && record.DutyDate === today && record.RecordStatus === 'ACTIVE';
  });
}

import memberNoteServiceInterceptor from './interceptors/member-note-service-logger-interceptor'

export const listMemberNotesService =
  memberNoteServiceInterceptor.listMemberNotesService
export const addMemberNoteService =
  memberNoteServiceInterceptor.addMemberNoteService
export const addMemberExchangeService =
  memberNoteServiceInterceptor.addMemberExchangeService
export const updateMemberNoteService =
  memberNoteServiceInterceptor.updateMemberNoteService
export const updateMemberExchangeService =
  memberNoteServiceInterceptor.updateMemberExchangeService
export const deleteMemberNoteService =
  memberNoteServiceInterceptor.deleteMemberNoteService

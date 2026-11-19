import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import type { AcademicStructure, Section } from '@/types'
import type { StaffRow } from './apiTypes'

export type AcademicsData = Omit<AcademicStructure, 'sections'> & {
  sections: (Section & { learnerCount: number; classTeacherName?: string })[]
}

export const useAcademics = () => useQuery({ queryKey: ['academics'], queryFn: () => api.get<AcademicsData>('/academics') })

export const useStaff = (enabled = true) => useQuery({ queryKey: ['staff'], queryFn: () => api.get<StaffRow[]>('/staff'), enabled })

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')

export const useNotificationCounts = (enabled = true) =>
  useQuery({ queryKey: ['notification-counts'], queryFn: () => api.get<{ announcements: number; messages: number }>('/notifications/counts'), refetchInterval: 30_000, enabled })

'use client';

import { Trash2, Users } from 'lucide-react';
import { EMPLOYEE_ROLES, GAME_CONFIG, getEmployeeRole } from '@/lib/game-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useBusinessDetail } from './context';

/**
 * Hiring, firing and the wage bill.
 *
 * Split out of `BusinessDetail.tsx`, which had grown to 1,729 lines — long
 * past the point where the panel you were editing could be found, let alone
 * reviewed. The markup is unchanged; only its home is.
 */
export default function StaffTab() {
  const {
    employees,
    firingId,
    handleFire,
    handleHire,
    hireRole,
    hiring,
    setHireRole,
    setShowHireDialog,
    showHireDialog,
  } = useBusinessDetail();

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Staff ({employees.length}/{GAME_CONFIG.maxEmployees})</h3>
          <Button size="sm" className="gap-1 text-white text-xs" style={{ background: '#006a4e' }} onClick={() => setShowHireDialog(true)} disabled={employees.length >= GAME_CONFIG.maxEmployees}>
            <Users className="h-3.5 w-3.5" /> Hire
          </Button>
        </div>

        <Dialog open={showHireDialog} onOpenChange={setShowHireDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Hire Employee</DialogTitle>
              <DialogDescription>Choose a role for your new employee</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {EMPLOYEE_ROLES.map((role) => (
                <button
                  key={role.role}
                  onClick={() => setHireRole(role.role)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${hireRole === role.role ? 'border-green-500 dark:border-green-700/70 bg-green-50 dark:bg-green-950/40' : 'hover:border-green-300 dark:hover:border-green-800/70 dark:border-green-800/70'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{role.icon}</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{role.label}</div>
                      <div className="text-xs text-muted-foreground">{role.description}</div>
                      <div className="text-xs mt-0.5">Salary: ~৳{role.baseSalary.toLocaleString()}/day</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowHireDialog(false)}>Cancel</Button>
              <Button onClick={handleHire} disabled={!hireRole || hiring} className="text-white" style={{ background: '#006a4e' }}>
                {hiring ? 'Hiring...' : 'Hire'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {employees.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <div className="text-4xl mb-2">👥</div>
              <p className="text-sm text-muted-foreground">No employees. Hire staff to boost your business!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {employees.map((emp: any) => {
              const role = getEmployeeRole(emp.role);
              return (
                <Card key={emp.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl p-1.5 rounded-lg bg-muted">{role?.icon || '👤'}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{emp.name}</div>
                        <div className="text-xs text-muted-foreground">{role?.label || emp.role}</div>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">Skill: {emp.skill}/10</Badge>
                          <Badge variant="outline" className="text-xs">Eff: {emp.efficiency || 0}%</Badge>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-medium">৳{(emp.salary || 0).toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">salary/day</div>
                        <Button size="icon" variant="ghost" className="h-7 w-7 mt-1 text-red-400 dark:text-red-300 hover:text-red-600 dark:hover:text-red-400 dark:text-red-400" onClick={() => handleFire(emp.id)} disabled={firingId === emp.id}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

'use client';
import React, { useState, useMemo } from 'react';
import type { BIData } from '@/app/bi/page';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { ClinicType } from '@/lib/definitions';

type FilterType = 'today' | 'week' | 'month' | 'range';

export function BIDashboard({ initialData }: { initialData: BIData }) {
    const [activeFilter, setActiveFilter] = useState<FilterType>('month');
    const [dateRange, setDateRange] = useState<DateRange | undefined>();

    const filteredData = useMemo(() => {
        let filterFn: (app: { date: string }) => boolean;
        const now = new Date();

        switch (activeFilter) {
            case 'week':
                const weekStart = startOfWeek(now, { weekStartsOn: 1 });
                const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
                filterFn = (app) => isWithinInterval(parseISO(app.date), { start: weekStart, end: weekEnd });
                break;
            case 'month':
                const monthStart = startOfMonth(now);
                const monthEnd = endOfMonth(now);
                filterFn = (app) => isWithinInterval(parseISO(app.date), { start: monthStart, end: monthEnd });
                break;
            case 'range':
                if (dateRange?.from && dateRange?.to) {
                    const rangeStart = startOfDay(dateRange.from);
                    const rangeEnd = endOfDay(dateRange.to);
                    filterFn = (app) => isWithinInterval(parseISO(app.date), { start: rangeStart, end: rangeEnd });
                } else {
                    return null; // Don't filter if range is incomplete
                }
                break;
            case 'today':
            default:
                const todayStart = startOfDay(now);
                const todayEnd = endOfDay(now);
                filterFn = (app) => isWithinInterval(parseISO(app.date), { start: todayStart, end: todayEnd });
                break;
        }

        if (!filterFn) return null;

        return {
            appointments: initialData.appointments.filter(filterFn),
            labAppointments: initialData.labAppointments.filter(filterFn),
            xRayAppointments: initialData.xRayAppointments.filter(filterFn),
            ultrasoundAppointments: initialData.ultrasoundAppointments.filter(filterFn),
            vaccineAppointments: initialData.vaccineAppointments.filter(filterFn),
        };
    }, [initialData, activeFilter, dateRange]);

    const summaryData = useMemo(() => {
        if (!filteredData) return [];
        return [
            { name: 'Citas Médicas', count: filteredData.appointments.length },
            { name: 'Laboratorio', count: filteredData.labAppointments.length },
            { name: 'Rayos X', count: filteredData.xRayAppointments.length },
            { name: 'Ultrasonidos', count: filteredData.ultrasoundAppointments.length },
            { name: 'Vacunas', count: filteredData.vaccineAppointments.length },
        ].filter(item => item.count > 0);
    }, [filteredData]);

    const getClinicBreakdown = (appointments: { clinicId: string }[], clinics: BIData['clinics']) => {
        const clinicCounts = appointments.reduce((acc, app) => {
            if (app.clinicId) {
                acc[app.clinicId] = (acc[app.clinicId] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(clinicCounts).map(([clinicId, count]) => ({
            name: clinics.find(c => c.id === clinicId)?.name || 'Desconocido',
            count: count
        })).sort((a, b) => b.count - a.count);
    };

    const medicalClinicBreakdown = useMemo(() => getClinicBreakdown(filteredData?.appointments || [], initialData.clinics), [filteredData, initialData.clinics]);
    
    const consultaExternaClinics = useMemo(() => {
        return initialData.clinics.filter(c => c.clinicType === 'Consulta Externa' as ClinicType);
    }, [initialData.clinics]);

    const coloniaBreakdownData = useMemo(() => {
        if (!filteredData) return [];
        
        return consultaExternaClinics.map(clinic => {
            const appointmentsForClinic = filteredData.appointments.filter(app => app.clinicId === clinic.id);
            const coloniaCounts = appointmentsForClinic.reduce((acc, app) => {
                const colonia = app.coloniaName || 'No especificada';
                acc[colonia] = (acc[colonia] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const chartData = Object.entries(coloniaCounts).map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count);

            return { clinic, chartData };
        }).filter(item => item.chartData.length > 0);

    }, [filteredData, consultaExternaClinics]);


    const chartConfig = {
        count: {
            label: "Citas",
            color: "hsl(var(--chart-1))",
        },
    };

    return (
        <div className="container mx-auto py-8 space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="text-3xl font-bold font-headline">Panel de Business Intelligence</CardTitle>
                    <CardDescription>Análisis de datos del sistema de citas.</CardDescription>
                </CardHeader>
            </Card>

            <div className="flex flex-wrap items-center gap-2">
                <Button variant={activeFilter === 'today' ? 'default' : 'outline'} onClick={() => { setActiveFilter('today'); setDateRange(undefined); }}>Hoy</Button>
                <Button variant={activeFilter === 'week' ? 'default' : 'outline'} onClick={() => { setActiveFilter('week'); setDateRange(undefined); }}>Esta Semana</Button>
                <Button variant={activeFilter === 'month' ? 'default' : 'outline'} onClick={() => { setActiveFilter('month'); setDateRange(undefined); }}>Este Mes</Button>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button id="date" variant={activeFilter === 'range' ? 'default' : 'outline'} className={cn('w-full sm:w-[260px] justify-start text-left font-normal')}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, 'LLL dd, y')} - {format(dateRange.to, 'LLL dd, y')}</>) : (format(dateRange.from, 'LLL dd, y'))) : (<span>Seleccionar rango</span>)}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={(range) => { setDateRange(range); setActiveFilter('range'); }} numberOfMonths={2} locale={es} />
                    </PopoverContent>
                </Popover>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Resumen de Citas por Tipo</CardTitle>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                        <BarChart accessibilityLayer data={summaryData}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} />
                            <YAxis />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                        </BarChart>
                    </ChartContainer>
                </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {medicalClinicBreakdown.length > 0 && <Card>
                    <CardHeader><CardTitle>Citas Médicas por Núcleo</CardTitle></CardHeader>
                    <CardContent>
                        <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                           <BarChart data={medicalClinicBreakdown} layout="vertical">
                                <CartesianGrid horizontal={false} />
                                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={10} width={120} />
                                <XAxis type="number" />
                                <ChartTooltip cursor={{fill: 'hsl(var(--muted))'}} content={<ChartTooltipContent />} />
                                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>}
            </div>

             <Card>
                <CardHeader>
                    <CardTitle>Desglose de Consulta Externa por Colonia</CardTitle>
                    <CardDescription>Muestra la cantidad de citas de consulta externa solicitadas por cada colonia, agrupadas por núcleo básico.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    {coloniaBreakdownData.length > 0 ? coloniaBreakdownData.map(({ clinic, chartData }) => (
                        <Card key={clinic.id} className="bg-muted/30">
                            <CardHeader>
                                <CardTitle className="text-xl">{clinic.name}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
                                    <BarChart data={chartData} layout="vertical">
                                        <CartesianGrid horizontal={false} />
                                        <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={10} width={150} />
                                        <XAxis type="number" />
                                        <ChartTooltip cursor={{fill: 'hsl(var(--accent))'}} content={<ChartTooltipContent />} />
                                        <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                                    </BarChart>
                                </ChartContainer>
                            </CardContent>
                        </Card>
                    )) : (
                        <div className="text-center py-10 text-muted-foreground">
                            No hay datos de consulta externa por colonia para mostrar con los filtros seleccionados.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

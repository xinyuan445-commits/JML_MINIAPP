package com.glenls.jml.kit;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;


public class WeekDayKit {
    
    public static String getWeekDay(String dateStr){
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        LocalDate date = LocalDate.parse(dateStr, formatter);
        DayOfWeek dayOfWeek = date.getDayOfWeek();
        String[] weekDays = {"星期一", "星期二", "星期三", "星期四",
                "星期五", "星期六", "星期日"};
        return weekDays[dayOfWeek.ordinal()];
    }
    public static void main(String[] args) {
        System.out.println(getWeekDay("2025-03-09"));
    }
}

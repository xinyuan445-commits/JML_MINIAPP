package com.glenls.jml.constant;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;


@Getter
@NoArgsConstructor
public enum CaseCommType {

    NEW("NEW","新建"),
    FKYJ("FKYJ","反馈意见"),
    CLFA("CLFA","处理方案"),
    ZLYJ("ZLYJ","质量意见"),
    ECSP("ECSP","二次审批"),
    CLOSE("CLOSE","结案"),
    PROC("PROC","处理中"),


    EE("EE","内部人员"),
    SA("SA","销售助理"),
    SD("SD","销售总监"),
    FM("FM","工厂人员"),
    GM("GM","总经理"),


    REJECT("REJECT","拒绝"),
    PASS("PASS","通过"),
    SL("SL","受理"),
    SMT("SMT","提交"),
    DRAFT("DRAFT","草稿"),


    INTIK("INTIK","内部工单"),


    SERVICE_TYPE_SHFW("SHFW","售后服务"),

    SOLUTION_TYPE_TH("退货","退货"),
    SOLUTION_TYPE_HH("换货","换货"),
    SOLUTION_TYPE_FG("返工","返工"),
    SOLUTION_TYPE_ZR("折让","折让"),
    SOLUTION_TYPE_SP("索赔","索赔"),
    SOLUTION_TYPE_BYSL("不予受理","不予受理"),

    QA_STATUS_Y("Y","已受理"),
    QA_STATUS_N("N","未受理"),

    MSG_TYPE_STAGE("1","过程提醒"),
    MSG_TYPE_CLOSE("2","关闭提醒"),
    MSG_TYPE_RETURN("3","退回提醒"),


    KML("KML","科米龙"),
    WF("WF","金米龙潍坊");






    private String code;
    private String desc;


    CaseCommType(String code, String desc) {
        this.code = code;
        this.desc = desc;
    }

    public String getCode() {
        return code;
    }

    public String getDesc() {
        return desc;
    }
    public static String getDescByCode(String code) {
        for (CaseCommType CaseCommType : CaseCommType.values()) {
            if (CaseCommType.code.equals(code)) {
                return CaseCommType.desc;
            }
        }
        return null;
    }
}

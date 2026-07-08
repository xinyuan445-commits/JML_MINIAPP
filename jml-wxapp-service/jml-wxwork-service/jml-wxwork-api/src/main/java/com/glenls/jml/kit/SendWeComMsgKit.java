package com.glenls.jml.kit;

import com.glenls.commons.jfinal_wxwork.sdk.api.SendMessageApi;
import com.glenls.commons.jfinal_wxwork.sdk.msg.send.QiYeTextMsg;
import com.glenls.commons.jfinal_wxwork.sdk.msg.send.Text;
import lombok.extern.slf4j.Slf4j;

import static com.glenls.jml.modules.pub.kit.JmlKit.getSiteUrl;
import static com.glenls.wxwork.kit.WxWorkKit.getAgentId;


@Slf4j
public class SendWeComMsgKit {

    
    public static void  sendReimWeComMsg(String staffName,String reimId){
        String content = "用户"+staffName+"发起的新的费用报销单<a href=\""+getSiteUrl()+"/costInfo?id="+reimId+"\">请查看</a>";
        Text text = new Text(content);
        QiYeTextMsg msg = new QiYeTextMsg();
        msg.setText(text);
        msg.setAgentid(getAgentId());
        
        msg.setTouser("13510310774");
        msg.setMsgtype("text");
        SendMessageApi.sendTextMsg(msg);
    }


    public static void sendSalesReportWeComMsg(String staffName,String salesReportId,String dateStr){
        String content = "用户"+staffName+"于"+dateStr+"提交了工作报告";
        Text text = new Text(content);
        QiYeTextMsg msg = new QiYeTextMsg();
        msg.setText(text);
        msg.setAgentid(getAgentId());
        
        msg.setTouser("13510310774");
        msg.setMsgtype("text");
        SendMessageApi.sendTextMsg(msg);
    }

    
    public static void sendMentionedUsersMsg(String staffName, String staffUserId,String salesReportId){
        try {
            String content = "您的同事"+staffName+"在工作报告的评论中@了您，<a href=\""+getSiteUrl()+"/workreportInfo?id="+salesReportId+"\">请查看</a>";
            Text text = new Text(content);
            QiYeTextMsg msg = new QiYeTextMsg();
            msg.setText(text);
            msg.setAgentid(getAgentId());
            msg.setTouser(staffUserId);
            msg.setMsgtype("text");
            SendMessageApi.sendTextMsg(msg);
        } catch (Exception e) {
            log.error(e.getMessage(),e);
        }

    }
}

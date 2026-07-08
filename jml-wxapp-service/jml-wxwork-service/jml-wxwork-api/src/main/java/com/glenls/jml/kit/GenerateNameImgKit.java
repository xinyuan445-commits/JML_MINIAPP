package com.glenls.jml.kit;
import cn.hutool.core.img.GraphicsUtil;
import cn.hutool.core.img.ImgUtil;
import cn.hutool.core.io.FileUtil;
import com.glenls.api.modules.pub.kit.FileKit;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.jfinal.kit.PathKit;
import io.jboot.Jboot;
import org.apache.commons.lang3.StringUtils;

import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.File;

public class GenerateNameImgKit {

    public static void main(String[] args) {
        generateNameImg("胡小帅","11111");
    }


    public static String generateNameImg(String userName, String id){
        String basepath = FileKit.getUploadBasePath();
        if (!basepath.startsWith("/") && StringUtils.appendIfMissing(basepath,"/","/").indexOf(":") == -1) {
            basepath = PathKit.getWebRootPath() + "/" + basepath;
        }
        String text = "@"+userName;
        Font font = new Font("Microsoft YaHei", Font.PLAIN, 14);
        FontMetrics metrics = new BufferedImage(1, 1, BufferedImage.TYPE_INT_ARGB).getGraphics().getFontMetrics(font);
        int textWidth = metrics.stringWidth(text);
        int width = textWidth + 12;
        int height = 15;

        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = image.createGraphics();
        g.setComposite(AlphaComposite.getInstance(AlphaComposite.CLEAR, 0.0f));
        g.fillRect(0, 0, width, height);
        g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER));
        g.setComposite(AlphaComposite.Src);
        g.setFont(font);
        Color textColor = new Color(0x849EB2);
        g.setColor(textColor);
        g.drawString(text, 5, 14);
        g.dispose();
        String filePath = Jboot.configValue("baseline.upload.url")+"upload/nameimg/" +id+".png";
        File outputFile = FileUtil.file(StringUtils.appendIfMissing(basepath,"/nameimg/","/")+id+".png");
        ImgUtil.write(image, outputFile);

        return filePath;
    }



}

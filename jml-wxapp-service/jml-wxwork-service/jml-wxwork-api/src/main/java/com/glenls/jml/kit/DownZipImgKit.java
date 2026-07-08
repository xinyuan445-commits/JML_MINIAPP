package com.glenls.jml.kit;

import cn.hutool.core.io.FileUtil;
import cn.hutool.core.util.IdUtil;
import cn.hutool.core.util.ZipUtil;
import cn.hutool.http.HttpUtil;
import com.glenls.api.modules.pub.kit.FileKit;
import com.jfinal.kit.PathKit;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;

import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.File;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;


@Slf4j
public class DownZipImgKit {


   public static File getZipFile(List<String> imgList) {
       List<File> fileList = new ArrayList<>();
       String basepath = FileKit.getUploadBasePath();
       if (!basepath.startsWith("/") && StringUtils.appendIfMissing(basepath,"/","/").indexOf(":") == -1) {
           basepath = PathKit.getWebRootPath() + "/" + basepath;
       }
       for(int i = 0; i < imgList.size(); i++) {
            String fileName =basepath+(i+1)+getExtension(imgList.get(i));
            HttpUtil.downloadFile(imgList.get(i),FileUtil.file(fileName));
            fileList.add(new File(fileName));
       }
       SimpleDateFormat sdf = new SimpleDateFormat("yyyyMMdd_HHmmss");
       String zipFileName = "files_" + sdf.format(new Date()) + "_" + IdUtil.simpleUUID() + ".zip";
       File zipFile = new File(StringUtils.appendIfMissing(basepath,"/","/") + zipFileName);
       ZipUtil.zip(zipFile, false,
               fileList.toArray(new File[0])
       );
       return zipFile;
   }

    public static void main(String[] args) {

    }

    public static String getExtension(String fileUrl) {
        int dotIndex = fileUrl.lastIndexOf('.');
        String extension = "";
        if (dotIndex >= 0) {
            extension = fileUrl.substring(dotIndex);
        }
        return extension;
    }




}

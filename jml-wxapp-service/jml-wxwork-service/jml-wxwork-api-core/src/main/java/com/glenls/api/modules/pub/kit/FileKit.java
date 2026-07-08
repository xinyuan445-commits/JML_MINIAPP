package com.glenls.api.modules.pub.kit;

import com.glenls.api.modules.pub.pojo.file.UploadFileRetPojo;
import com.glenls.commons.lang.kit.EncryptUtils;
import com.jfinal.kit.PathKit;
import com.jfinal.upload.UploadFile;
import io.jboot.Jboot;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.FilenameUtils;
import org.apache.commons.lang3.RandomStringUtils;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.time.DateFormatUtils;

import java.io.File;
import java.text.SimpleDateFormat;
import java.util.Date;


@Slf4j
public class FileKit {

    
    public static final String getUploadBasePath() {
        return Jboot.configValue("baseline.upload.path");
    }

    
    public static String generateRandomPath() {
        return DateFormatUtils.format(new Date(), "yyyy/MM/dd/HH");
    }

    
    public static String getUUID() {
        String uuId = "0";
        SimpleDateFormat sf = new SimpleDateFormat("yyyyMMddHHmmssSSS");
        String tempId = sf.format(new Date());
        if (Long.parseLong(uuId) >= Long.parseLong(tempId)) {
            uuId = (new StringBuilder(String.valueOf(Long.parseLong(uuId) + 1L))).toString();
        } else {
            uuId = tempId;
        }
        return uuId + RandomStringUtils.randomNumeric(4);
    }


    
    public static UploadFileRetPojo create4Upload(UploadFile uploadFile) {
        UploadFileRetPojo fileRetPojo = null;

        if (uploadFile != null) {
            fileRetPojo = new UploadFileRetPojo();


            String basepath = FileKit.getUploadBasePath();
            if (!basepath.startsWith("/") && basepath.indexOf(":") == -1) {
                basepath = PathKit.getWebRootPath() + "/" + basepath;
            }

            File file = uploadFile.getFile();
            String fileName = file.getName();
            String fileExt = FilenameUtils.getExtension(fileName);

            fileRetPojo.setFileName(fileName);
            fileRetPojo.setMd5(EncryptUtils.md5(file));
            fileRetPojo.setContentType(uploadFile.getContentType());
            fileRetPojo.setFileExt(fileExt);

            String randomPath = FileKit.generateRandomPath() + "/";
            String newFileName = randomPath + EncryptUtils.sha1(FileKit.getUUID()) + "." + fileExt;
            String newFileFullPath = FilenameUtils.concat(basepath,newFileName);

            File randomDir = new File(StringUtils.appendIfMissing(basepath,"/","/") + randomPath);
            if (!randomDir.exists()) {
                randomDir.mkdirs();
            }

            file.renameTo(new File(newFileFullPath));


            fileRetPojo.setPath(newFileName.replace("\\", "/"));
        }

        return fileRetPojo;
    }
}

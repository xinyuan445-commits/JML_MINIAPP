package com.glenls.api.modules.pub.controller;

import cn.hutool.core.io.file.FileNameUtil;
import com.glenls.api.modules.pub.busi.DictBusi;
import com.glenls.api.modules.pub.kit.FileKit;
import com.glenls.api.modules.pub.pojo.file.UploadFileRetPojo;
import com.glenls.commons.jboot.controller.BaseController;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.jfinal.aop.Inject;
import io.jboot.Jboot;
import io.jboot.web.controller.annotation.RequestMapping;
import org.apache.commons.io.FilenameUtils;
import org.apache.commons.lang3.StringUtils;


@RequestMapping("/api/core/file")
public class FileController extends BaseController {


    public void upload(){
        UploadFileRetPojo retPojo = FileKit.create4Upload(getFile("file"));
        retPojo.setUrl(new StringBuffer(Jboot.configValue("baseline.upload.url")).append("upload/"+retPojo.getPath()).toString());
        renderJson(RestApiResult.newSuccessWithData(retPojo));
    }
}

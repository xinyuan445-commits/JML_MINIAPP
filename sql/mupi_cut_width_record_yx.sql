USE [yx_test];
GO

IF OBJECT_ID(N'dbo.MupiCutWidthRecord_yx', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.MupiCutWidthRecord_yx
    (
        RecordId BIGINT IDENTITY(1, 1) NOT NULL,
        RequestId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_MupiCutWidthRecord_RequestId DEFAULT NEWID(),
        ScanContent NVARCHAR(500) NOT NULL,
        ScanHash CHAR(64) NOT NULL,
        CutNo INT NOT NULL,
        LengthCm DECIMAL(10, 2) NOT NULL
            CONSTRAINT DF_MupiCutWidthRecord_LengthCm DEFAULT (285.00),
        WidthCm DECIMAL(10, 2) NOT NULL,
        OperatorId NVARCHAR(64) NOT NULL,
        OperatorName NVARCHAR(100) NOT NULL
            CONSTRAINT DF_MupiCutWidthRecord_OperatorName DEFAULT (N''),
        CreatedAt DATETIME2(0) NOT NULL
            CONSTRAINT DF_MupiCutWidthRecord_CreatedAt DEFAULT SYSDATETIME(),

        CONSTRAINT PK_MupiCutWidthRecord PRIMARY KEY CLUSTERED (RecordId),
        CONSTRAINT UQ_MupiCutWidthRecord_RequestId UNIQUE (RequestId),
        CONSTRAINT UQ_MupiCutWidthRecord_ScanCut UNIQUE (ScanHash, CutNo),
        CONSTRAINT CK_MupiCutWidthRecord_CutNo CHECK (CutNo > 0),
        CONSTRAINT CK_MupiCutWidthRecord_LengthCm CHECK (LengthCm > 0),
        CONSTRAINT CK_MupiCutWidthRecord_WidthCm CHECK (WidthCm > 0)
    );

    CREATE INDEX IX_MupiCutWidthRecord_ScanHistory
        ON dbo.MupiCutWidthRecord_yx (ScanHash, RecordId DESC)
        INCLUDE (ScanContent, CutNo, LengthCm, WidthCm, OperatorId, OperatorName, CreatedAt);
END;
GO

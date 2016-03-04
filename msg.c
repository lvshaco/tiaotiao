#define MSG_HEAD \
    uint8_t msgid;


// ----- request

// 255 进入棋盘
struct EnterBoard {
    MSG_HEAD;
    uint32_t protocol; // 保留字段，当前为0
    uint8_t index; // 创建的index
    uint8_t name_len; // 名字长度
    name bytes; // 名字字节
};

// 21 吐出质量（按键）
struct EjectMass {
    MSG_HEAD;
};

// 17 分裂（按键）
struct SplitCell {
    MSG_HEAD;
};

// 16 移动到目标
struct MoveTo {
    MSG_HEAD;
    int32_t target_x;
    int32_t target_y;
};

// response

// 64 （通知棋盘大小）
struct SetBorder {
    MSG_HEAD;
    int32_t left;
    int32_t top;
    int32_t right;
    int32_t bottom;
};

// 32 （添加自己控制的细胞，进入期盼／分裂）
struct AddNode {
    uint32_t nodeid;
};

// 16 更新变化的节点（删除的，不可见的，变更的，包括自身和移动）
// 变长的结构体
struct UpdateNodes {
    uint16_t destroy_count;
    struct {
        uint32_t killerid;
        uint32_t nodeid;
    } vector;

    uint16_t unvisible_count;
    struct {
        uint32_t nodeid;
    } vector; 

    uint16_t node_count;
    struct {
        uint32_t nodeid;
        int32_t posx;
        int32_t posy;
        int16_t size;
        uint16_t index; // index 客户端取模
        uint8_t r;
        uint8_t g;
        uint8_t b;
        uint8_t spike;
        uint8_t name_len; // 名字的长度
        name bytes;// 名字字节
    } vector;
}; 

EnterBoard msg;
msg.msgid = 255;
msg.protocol = 0; // 现在直接填0，当前游戏版本
websocket_instance->send(msg, msgsize);

websocket_instance->read_uint8();


static char *buffer = NULL;



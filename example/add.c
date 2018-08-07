#include <emscripten.h>

extern "C"
{

	EMSCRIPTEN_KEEPALIVE
	int add(int a, int b)
	{
		return a + b;
	}

}